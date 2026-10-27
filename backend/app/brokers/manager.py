import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.brokers.base import (
    BrokerAdapter, 
    Position, 
    Order, 
    OrderRequest, 
    OrderResponse, 
    AccountInfo, 
    BrokerTrade
)
from backend.app.brokers.dhan import DhanAdapter
from backend.app.brokers.upstox import UpstoxAdapter
from backend.app.brokers.zerodha import ZerodhaAdapter
from backend.app.brokers.fyers import FyersAdapter
from backend.app.brokers.angel_one import AngelOneAdapter
from backend.app.brokers.breeze import BreezeAdapter
from backend.app.brokers.us_broker import USBrokerAdapter
from backend.app.brokers.crypto_broker import CryptoBrokerAdapter
from backend.app.brokers.encryption import decrypt_credential
from backend.app.state_manager import state_manager
from backend.app.models import BrokerConfig, KillSwitchAction, Trade, TiltEvent
from backend.app.rules_engine import RulesEngine
from backend.app.routes.baseline import get_or_create_baseline

logger = logging.getLogger("BrokerManager")

ADAPTER_MAP = {
    # Indian Brokers (₹ INR)
    "dhan": DhanAdapter,
    "upstox": UpstoxAdapter,
    "zerodha": ZerodhaAdapter,
    "fyers": FyersAdapter,
    "angelone": AngelOneAdapter,
    "breeze": BreezeAdapter,
    # US Brokers ($ USD)
    "alpaca": USBrokerAdapter,
    "interactive_brokers": USBrokerAdapter,
    "tradestation": USBrokerAdapter,
    "us_equities": USBrokerAdapter,
    # Crypto Brokers (USDT)
    "binance": CryptoBrokerAdapter,
    "bybit": CryptoBrokerAdapter,
    "crypto": CryptoBrokerAdapter
}

class BrokerManager:
    """
    Central orchestrator holding active broker adapters per trader.
    - Intercepts orders and applies the Kill Switch intelligence layer.
    - Synchronizes trades from broker (WebSocket + 30s polling fallback).
    - Deduplicates trades by order ID before evaluating in RulesEngine.
    - Enforces Kill Switch broker actions (order cancellation, position square-off).
    """
    def __init__(self):
        # trader_id -> BrokerAdapter
        self._active_adapters: Dict[str, BrokerAdapter] = {}
        # trader_id -> active broker name
        self._active_broker_name: Dict[str, str] = {}
        # trader_id -> set of processed trade/order IDs for deduplication
        self._processed_trade_ids: Dict[str, set] = {}
        # background sync task
        self._sync_task: Optional[asyncio.Task] = None
        self._is_running = False

    def get_adapter(self, trader_id: str) -> Optional[BrokerAdapter]:
        return self._active_adapters.get(trader_id)

    def register_adapter(self, trader_id: str, broker_name: str, config: Dict[str, Any]) -> BrokerAdapter:
        broker_key = broker_name.lower().strip()
        adapter_cls = ADAPTER_MAP.get(broker_key, DhanAdapter)
        adapter = adapter_cls(config)
        self._active_adapters[trader_id] = adapter
        self._active_broker_name[trader_id] = broker_key
        if trader_id not in self._processed_trade_ids:
            self._processed_trade_ids[trader_id] = set()
        return adapter

    def unregister_adapter(self, trader_id: str):
        self._active_adapters.pop(trader_id, None)
        self._active_broker_name.pop(trader_id, None)

    async def place_order_intercepted(
        self,
        trader_id: str,
        order: OrderRequest,
        db: AsyncSession,
        soft_lock_confirmation: Optional[str] = None
    ) -> OrderResponse:
        """
        Intercepts an outgoing order request:
        1. Checks Kill Switch state.
        2. If in Red zone -> blocks execution immediately.
        3. If in Orange zone -> enforces soft lock wait or confirmation phrase.
        4. If allowed -> routes order to active broker adapter.
        """
        adapter = self.get_adapter(trader_id)
        if not adapter:
            # Fallback to simulated Dhan adapter if none explicitly connected
            adapter = self.register_adapter(trader_id, "dhan", {"trader_id": trader_id, "is_sandbox": True})

        # 1. State check
        allowed, block_type, reason_msg = state_manager.check_trade_allowed(
            trader_id,
            soft_lock_confirmation
        )
        if not allowed:
            # Log blocked attempt
            state = state_manager.get_or_create_state(trader_id)
            return OrderResponse(
                order_id=f"BLK_{order.symbol}",
                status="BLOCKED_KILL_SWITCH",
                message=reason_msg or "Order blocked by AegisTilt Kill Switch.",
                is_blocked_by_kill_switch=True
            )

        # 2. Route to broker
        response = await adapter.place_order(order)
        return response

    async def execute_kill_switch_broker_action(
        self,
        trader_id: str,
        db: AsyncSession,
        tilt_score: int,
        session_id: str,
        auto_square_off: bool = False
    ) -> Dict[str, Any]:
        """
        Enforces physical broker actions when Hard Kill Switch triggers:
        1. Cancels all pending/open orders on the broker.
        2. Optionally squares off all open positions if configured.
        3. Sets broker adapter flag is_trading_blocked = True.
        4. Immutably records action in KillSwitchAction table.
        """
        adapter = self.get_adapter(trader_id)
        cancelled_orders = []
        squared_off_positions = []

        if adapter:
            # 1. Block further trading on the broker adapter
            await adapter.block_trading()

            # 2. Get and cancel all open orders
            try:
                orders = await adapter.get_order_history()
                open_orders = [o for o in orders if o.status in ["OPEN", "PENDING", "TRIGGER_PENDING"]]
                for o in open_orders:
                    success = await adapter.cancel_order(o.order_id)
                    if success:
                        cancelled_orders.append({
                            "order_id": o.order_id,
                            "symbol": o.symbol,
                            "quantity": o.quantity,
                            "price": o.price
                        })
            except Exception as e:
                logger.error(f"Error cancelling orders during kill switch: {e}")

            # 3. Optional position square-off
            if auto_square_off:
                try:
                    positions = await adapter.get_positions()
                    for p in positions:
                        if p.quantity != 0:
                            # Place counter order to close position
                            sq_req = OrderRequest(
                                symbol=p.symbol,
                                transaction_type="SELL" if p.quantity > 0 else "BUY",
                                order_type="MARKET",
                                quantity=abs(p.quantity),
                                product_type=p.product_type,
                                tag="kill-switch-square-off"
                            )
                            await adapter.place_order(sq_req)
                            squared_off_positions.append({
                                "symbol": p.symbol,
                                "quantity": p.quantity,
                                "pnl": p.pnl
                            })
                except Exception as e:
                    logger.error(f"Error squaring off positions during kill switch: {e}")

        # 4. Record action in database
        action_log = KillSwitchAction(
            trader_id=trader_id,
            session_id=session_id,
            action_type="hard_lock_broker_action",
            triggered_at=datetime.utcnow(),
            tilt_score_at_trigger=tilt_score,
            metadata_json=json.dumps({
                "broker": self._active_broker_name.get(trader_id, "dhan"),
                "cancelled_orders_count": len(cancelled_orders),
                "cancelled_orders": cancelled_orders,
                "squared_off_positions_count": len(squared_off_positions),
                "squared_off_positions": squared_off_positions
            })
        )
        db.add(action_log)
        await db.commit()

        # 5. Broadcast to WebSocket
        await state_manager.broadcast_tilt_update(trader_id, {
            "type": "BROKER_KILL_SWITCH_EXECUTED",
            "trader_id": trader_id,
            "broker": self._active_broker_name.get(trader_id, "dhan"),
            "cancelled_orders": cancelled_orders,
            "squared_off_positions": squared_off_positions,
            "message": f"Kill Switch executed at broker level: {len(cancelled_orders)} orders cancelled."
        })

        return {
            "status": "success",
            "cancelled_orders": cancelled_orders,
            "squared_off_positions": squared_off_positions
        }

    async def sync_trades_from_broker(self, trader_id: str, db: AsyncSession) -> int:
        """
        Synchronizes trades from the active broker into the AegisTilt rules engine.
        - Deduplicates trades by trade_id/order_id.
        - Feeds new trades into RulesEngine.
        - Updates Tilt Score in real-time.
        """
        adapter = self.get_adapter(trader_id)
        if not adapter:
            return 0

        try:
            broker_trades = await adapter.get_trades()
        except Exception as e:
            logger.error(f"Failed to fetch trades from broker: {e}")
            return 0

        new_trades_count = 0
        state = state_manager.get_or_create_state(trader_id)
        session_id = state.get("session_id", "default_sess")
        baseline = await get_or_create_baseline(trader_id, db)
        rules_engine = RulesEngine(baseline)

        processed = self._processed_trade_ids.setdefault(trader_id, set())

        for bt in broker_trades:
            if bt.trade_id in processed:
                continue

            processed.add(bt.trade_id)
            new_trades_count += 1

            # Estimate or calculate realized PnL from broker trade
            trade_pnl = bt.pnl if bt.pnl is not None else 0.0

            # Create Trade model
            trade_obj = Trade(
                trader_id=trader_id,
                session_id=session_id,
                instrument=bt.symbol,
                trade_type="long" if bt.transaction_type.upper() == "BUY" else "short",
                entry_price=bt.execution_price,
                exit_price=bt.execution_price + (trade_pnl / max(1.0, bt.quantity)),
                position_size=bt.quantity,
                pnl=trade_pnl,
                timestamp=bt.timestamp or datetime.utcnow(),
                duration_seconds=60,
                notes=f"Synced from broker {adapter.broker_name}"
            )
            db.add(trade_obj)
            await db.flush()

            # Query prior trades
            stmt = select(Trade).where(
                Trade.trader_id == trader_id,
                Trade.session_id == session_id,
                Trade.id != trade_obj.id
            ).order_by(Trade.timestamp.asc())
            res = await db.execute(stmt)
            prior_trades = res.scalars().all()

            # Evaluate rules engine
            current_score = state.get("current_score", 0)
            events, new_score, new_status = rules_engine.evaluate_trade(
                trade_obj,
                prior_trades,
                current_score
            )

            # Record events
            for ev in events:
                tilt_ev = TiltEvent(
                    trader_id=trader_id,
                    session_id=session_id,
                    event_type=ev["event_type"],
                    points_added=ev["points_added"],
                    timestamp=trade_obj.timestamp,
                    trade_id=trade_obj.id,
                    metadata_json=json.dumps(ev.get("metadata", {}))
                )
                db.add(tilt_ev)

            # Update state manager
            state_manager.update_score(
                trader_id=trader_id,
                new_score=new_score,
                status=new_status,
                session_id=session_id,
                soft_lock_wait_sec=baseline.soft_lock_cooldown_seconds,
                hard_lock_cooldown_min=baseline.hard_lock_cooldown_minutes
            )

            # Check if Hard Lock triggered
            if new_status == "red":
                await self.execute_kill_switch_broker_action(
                    trader_id=trader_id,
                    db=db,
                    tilt_score=new_score,
                    session_id=session_id,
                    auto_square_off=False
                )

        if new_trades_count > 0:
            await db.commit()

        return new_trades_count

broker_manager = BrokerManager()
