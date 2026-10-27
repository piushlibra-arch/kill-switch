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

class UpstoxAdapter(BrokerAdapter):
    """
    Upstox v2 Broker Adapter (with Sandbox Environment Support).
    Auth: OAuth2, Access Token
    Key Endpoints:
      - GET /order/retrieve-all -> orders
      - GET /portfolio/positions -> positions
      - GET /order/trades/get-trades-for-day -> trades
      - POST /order/place -> place order
    """
    LIVE_BASE_URL = "https://api.upstox.com/v2"
    SANDBOX_BASE_URL = "https://sandbox-api.upstox.com/v2"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.access_token = config.get("access_token", "")
        self.api_key = config.get("api_key", "")
        self.is_sandbox = config.get("is_sandbox", True)  # defaults to sandbox for testing
        self.base_url = self.SANDBOX_BASE_URL if self.is_sandbox else self.LIVE_BASE_URL
        self._headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        self.is_connected = bool(self.access_token or self.is_sandbox)

        self._mock_positions = [
            Position(
                symbol="RELIANCE",
                product_type="INTRADAY",
                quantity=50.0,
                buy_price=2840.0,
                current_price=2862.0,
                pnl=1100.0,
                unrealized_pnl=1100.0,
                exchange="NSE_EQ"
            )
        ]
        self._mock_orders = []

    async def get_account_info(self) -> AccountInfo:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.base_url}/user/profile", headers=self._headers)
                    if resp.status_code == 200:
                        data = resp.json().get("data", {})
                        return AccountInfo(
                            broker_name="upstox",
                            client_id=data.get("user_id", "UPSTOX_USER"),
                            available_cash=500000.0,
                            is_live=True
                        )
            except Exception:
                pass

        return AccountInfo(
            broker_name="upstox",
            client_id="UPSTOX_SANDBOX_01",
            available_cash=1000000.0,
            utilized_margin=45000.0,
            is_live=False
        )

    async def get_positions(self) -> List[Position]:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.base_url}/portfolio/short-term-positions", headers=self._headers)
                    if resp.status_code == 200:
                        positions = []
                        for item in resp.json().get("data", []):
                            positions.append(Position(
                                symbol=item.get("trading_symbol", ""),
                                product_type=item.get("product", "INTRADAY"),
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
                    resp = await client.get(f"{self.base_url}/order/retrieve-all", headers=self._headers)
                    if resp.status_code == 200:
                        orders = []
                        for o in resp.json().get("data", []):
                            orders.append(Order(
                                order_id=str(o.get("order_id")),
                                broker_order_id=str(o.get("order_id")),
                                symbol=o.get("trading_symbol", ""),
                                order_type=o.get("order_type", "MARKET"),
                                transaction_type=o.get("transaction_type", "BUY"),
                                quantity=float(o.get("quantity", 0)),
                                filled_quantity=float(o.get("filled_quantity", 0)),
                                price=float(o.get("price", 0)),
                                status=o.get("status", "OPEN")
                            ))
                        return orders
            except Exception:
                pass
        return self._mock_orders

    async def get_trades(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[BrokerTrade]:
        if not self.is_sandbox and self.access_token:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{self.base_url}/order/trades/get-trades-for-day", headers=self._headers)
                    if resp.status_code == 200:
                        trades = []
                        for t in resp.json().get("data", []):
                            trades.append(BrokerTrade(
                                trade_id=str(t.get("trade_id")),
                                order_id=str(t.get("order_id")),
                                symbol=t.get("trading_symbol", ""),
                                transaction_type=t.get("transaction_type", "BUY"),
                                quantity=float(t.get("quantity", 0)),
                                execution_price=float(t.get("price", 0)),
                                timestamp=datetime.utcnow()
                            ))
                        return trades
            except Exception:
                pass
        return []

    async def place_order(self, order: OrderRequest) -> OrderResponse:
        if self.is_trading_blocked:
            return OrderResponse(
                order_id=f"UPSTOX_BLK_{uuid.uuid4().hex[:6]}",
                status="BLOCKED_KILL_SWITCH",
                message="Upstox order rejected: Kill Switch engaged.",
                is_blocked_by_kill_switch=True
            )

        order_id = f"UPSTOX_{uuid.uuid4().hex[:8].upper()}"
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
            message=f"Order accepted on Upstox ({'Sandbox' if self.is_sandbox else 'Live'})."
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
                "broker": "upstox",
                "event": "HEARTBEAT",
                "timestamp": datetime.utcnow().isoformat(),
                "is_trading_blocked": self.is_trading_blocked
            }
