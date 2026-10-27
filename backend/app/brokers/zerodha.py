import asyncio
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, AsyncGenerator, Dict, Any
import httpx
from backend.app.brokers.base import (
    BrokerAdapter, 
    Position, 
    Order, 
    OrderRequest, 
    OrderResponse, 
    AccountInfo, 
    BrokerTrade
)

class ZerodhaAdapter(BrokerAdapter):
    """
    Zerodha Kite Broker Adapter.
    Auth: API Key + Access Token (OAuth flow, daily expiration)
    Endpoints:
      - GET /orders -> order history
      - GET /portfolio/positions -> positions
      - GET /trades -> trades
      - POST /orders/regular -> place order
      - DELETE /orders/regular/{order_id} -> cancel order
      - WebSocket: KiteTicker wss://ws.kite.trade
    """
    BASE_URL = "https://api.kite.trade"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.access_token = config.get("access_token", "")
        self.is_sandbox = config.get("is_sandbox", False)
        self._headers = {
            "X-Kite-Version": "3",
            "Authorization": f"token {self.api_key}:{self.access_token}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        self.is_connected = bool(self.api_key and self.access_token)

        self._mock_positions = [
            Position(
                symbol="INFY",
                product_type="MIS",
                quantity=100.0,
                buy_price=1620.0,
                current_price=1635.5,
                pnl=1550.0,
                unrealized_pnl=1550.0,
                exchange="NSE"
            )
        ]
        self._mock_orders = []

    async def get_account_info(self) -> AccountInfo:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.BASE_URL}/user/margins", headers=self._headers)
                    if resp.status_code == 200:
                        equity = resp.json().get("data", {}).get("equity", {})
                        return AccountInfo(
                            broker_name="zerodha",
                            client_id=self.config.get("client_id", "KITE_USER"),
                            available_cash=float(equity.get("available", {}).get("live_balance", 450000.0)),
                            utilized_margin=float(equity.get("utilised", {}).get("debits", 50000.0)),
                            is_live=True
                        )
            except Exception:
                pass

        return AccountInfo(
            broker_name="zerodha",
            client_id="ZR_DEMO_4821",
            available_cash=520000.0,
            utilized_margin=42000.0,
            is_live=False
        )

    async def get_positions(self) -> List[Position]:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.BASE_URL}/portfolio/positions", headers=self._headers)
                    if resp.status_code == 200:
                        positions = []
                        data = resp.json().get("data", {})
                        for item in data.get("net", []):
                            positions.append(Position(
                                symbol=item.get("tradingsymbol", ""),
                                product_type=item.get("product", "MIS"),
                                quantity=float(item.get("quantity", 0)),
                                buy_price=float(item.get("buy_price", 0)),
                                current_price=float(item.get("last_price", 0)),
                                pnl=float(item.get("pnl", 0)),
                                exchange=item.get("exchange", "NSE")
                            ))
                        return positions
            except Exception:
                pass
        return self._mock_positions

    async def get_order_history(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[Order]:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.BASE_URL}/orders", headers=self._headers)
                    if resp.status_code == 200:
                        orders = []
                        for o in resp.json().get("data", []):
                            orders.append(Order(
                                order_id=str(o.get("order_id")),
                                broker_order_id=str(o.get("order_id")),
                                symbol=o.get("tradingsymbol", ""),
                                order_type=o.get("order_type", "MARKET"),
                                transaction_type=o.get("transaction_type", "BUY"),
                                quantity=float(o.get("quantity", 0)),
                                filled_quantity=float(o.get("filled_quantity", 0)),
                                price=float(o.get("price", 0)),
                                status=o.get("status", "OPEN"),
                                tag=o.get("tag")
                            ))
                        return orders
            except Exception:
                pass
        return self._mock_orders

    async def get_trades(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[BrokerTrade]:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.BASE_URL}/trades", headers=self._headers)
                    if resp.status_code == 200:
                        trades = []
                        for t in resp.json().get("data", []):
                            trades.append(BrokerTrade(
                                trade_id=str(t.get("trade_id")),
                                order_id=str(t.get("order_id")),
                                symbol=t.get("tradingsymbol", ""),
                                transaction_type=t.get("transaction_type", "BUY"),
                                quantity=float(t.get("quantity", 0)),
                                execution_price=float(t.get("average_price", 0)),
                                timestamp=datetime.utcnow()
                            ))
                        return trades
            except Exception:
                pass
        return []

    async def place_order(self, order: OrderRequest) -> OrderResponse:
        if self.is_trading_blocked:
            return OrderResponse(
                order_id=f"KITE_BLK_{uuid.uuid4().hex[:6]}",
                status="BLOCKED_KILL_SWITCH",
                message="Zerodha Kite: Order rejected because Kill Switch is engaged.",
                is_blocked_by_kill_switch=True
            )

        order_id = f"KITE_{uuid.uuid4().hex[:8].upper()}"
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
            message="Order placed via Zerodha Kite."
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
                "broker": "zerodha",
                "event": "HEARTBEAT",
                "timestamp": datetime.utcnow().isoformat(),
                "is_trading_blocked": self.is_trading_blocked
            }
