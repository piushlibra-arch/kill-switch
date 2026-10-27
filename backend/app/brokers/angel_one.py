import asyncio
import uuid
from datetime import datetime
from typing import List, Optional, AsyncGenerator, Dict, Any
import pyotp
from backend.app.brokers.base import (
    BrokerAdapter, 
    Position, 
    Order, 
    OrderRequest, 
    OrderResponse, 
    AccountInfo, 
    BrokerTrade
)

class AngelOneAdapter(BrokerAdapter):
    """
    Angel One (SmartAPI) Broker Adapter.
    Auth: API Key + Client Code + Password/PIN + TOTP (2FA via pyotp).
    """
    BASE_URL = "https://apiconnect.angelbroking.com"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.client_code = config.get("client_id", "")
        self.pin = config.get("pin", "")
        self.totp_secret = config.get("totp_secret", "")
        self.access_token = config.get("access_token", "")
        self.is_connected = bool(self.api_key and (self.access_token or (self.client_code and self.totp_secret)))

        self._mock_positions = [
            Position(
                symbol="HDFCBANK",
                product_type="INTRADAY",
                quantity=40.0,
                buy_price=1510.0,
                current_price=1522.0,
                pnl=480.0,
                exchange="NSE"
            )
        ]
        self._mock_orders = []

    def generate_totp(self) -> Optional[str]:
        """Generates current 6-digit TOTP from secret for 2FA login."""
        if self.totp_secret:
            try:
                totp = pyotp.TOTP(self.totp_secret.replace(" ", "").strip())
                return totp.now()
            except Exception:
                return None
        return None

    async def get_account_info(self) -> AccountInfo:
        return AccountInfo(
            broker_name="angelone",
            client_id=self.client_code or "ANGEL_USER",
            available_cash=620000.0,
            utilized_margin=65000.0,
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
                order_id=f"ANGEL_BLK_{uuid.uuid4().hex[:6]}",
                status="BLOCKED_KILL_SWITCH",
                message="SmartAPI: Order blocked by AegisTilt Kill Switch.",
                is_blocked_by_kill_switch=True
            )

        order_id = f"ANGEL_{uuid.uuid4().hex[:8].upper()}"
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
            message="Order routed through Angel One SmartAPI."
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
                "broker": "angelone",
                "event": "HEARTBEAT",
                "timestamp": datetime.utcnow().isoformat(),
                "is_trading_blocked": self.is_trading_blocked
            }
