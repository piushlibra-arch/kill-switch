import asyncio
import uuid
from datetime import datetime
from typing import List, Optional, AsyncGenerator, Dict, Any
from backend.app.brokers.base import (
    BrokerAdapter, 
    Position, 
    Order, 
    OrderRequest, 
    OrderResponse, 
    AccountInfo, 
    BrokerTrade
)

class CryptoBrokerAdapter(BrokerAdapter):
    """
    Crypto Broker Adapter (Binance / Bybit / OKX).
    Currency: USDT (Tether) with standard decimal formatting.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.secret_key = config.get("secret_key", "")
        self.is_connected = bool(self.api_key)
        self._mock_positions = [
            Position(
                symbol="BTCUSDT",
                product_type="PERPETUAL",
                quantity=0.5,
                buy_price=67200.0,
                current_price=68450.0,
                pnl=625.0,
                exchange="CRYPTO_FUTURES"
            ),
            Position(
                symbol="ETHUSDT",
                product_type="PERPETUAL",
                quantity=4.0,
                buy_price=2520.0,
                current_price=2490.0,
                pnl=-120.0,
                exchange="CRYPTO_FUTURES"
            )
        ]
        self._mock_orders = []

    async def get_account_info(self) -> AccountInfo:
        return AccountInfo(
            broker_name=self.broker_name,
            client_id=self.api_key[:8] if self.api_key else "CRYPTO_USER_77",
            available_cash=85000.0,
            utilized_margin=18000.0,
            currency="USDT",
            is_live=False
        )

    async def get_positions(self) -> List[Position]:
        return self._mock_positions

    async def get_order_history(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[Order]:
        return self._mock_orders

    async def get_trades(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[BrokerTrade]:
        return []

    async def place_order(self, order: OrderRequest) -> OrderResponse:
        if self.is_trading_blocked:
            return OrderResponse(
                order_id=f"CRYPTO_BLK_{uuid.uuid4().hex[:6]}",
                status="BLOCKED_KILL_SWITCH",
                message="Crypto Futures: Order blocked by AegisTilt Kill Switch.",
                is_blocked_by_kill_switch=True
            )
        order_id = f"CRYPTO_{uuid.uuid4().hex[:8].upper()}"
        new_order = Order(
            order_id=order_id,
            broker_order_id=order_id,
            symbol=order.symbol,
            order_type=order.order_type,
            transaction_type=order.transaction_type,
            quantity=order.quantity,
            price=order.price,
            status="COMPLETE",
            tag=order.tag
        )
        self._mock_orders.insert(0, new_order)
        return OrderResponse(
            order_id=order_id,
            broker_order_id=order_id,
            status="SUBMITTED",
            message=f"Order executed on {self.broker_name.upper()} in USDT."
        )

    async def cancel_order(self, order_id: str) -> bool:
        for o in self._mock_orders:
            if o.order_id == order_id:
                o.status = "CANCELLED"
                return True
        return True

    async def block_trading(self) -> bool:
        self.is_trading_blocked = True
        for o in self._mock_orders:
            if o.status == "OPEN":
                o.status = "CANCELLED"
        return True

    async def stream_order_updates(self) -> AsyncGenerator[Dict[str, Any], None]:
        while True:
            await asyncio.sleep(10)
            yield {
                "broker": self.broker_name,
                "event": "HEARTBEAT",
                "timestamp": datetime.utcnow().isoformat(),
                "is_trading_blocked": self.is_trading_blocked
            }
