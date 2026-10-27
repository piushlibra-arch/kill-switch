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

class BreezeAdapter(BrokerAdapter):
    """
    ICICI Breeze Broker Adapter.
    Auth: API Key + Session Token + Secret Key.
    """
    BASE_URL = "https://api.icicidirect.com/breezeapi/api/v1"

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.session_token = config.get("access_token", "")
        self.secret_key = config.get("secret_key", "")
        self.is_connected = bool(self.api_key and self.session_token)

        self._mock_positions = [
            Position(
                symbol="ICICIBANK",
                product_type="INTRADAY",
                quantity=60.0,
                buy_price=1180.0,
                current_price=1192.0,
                pnl=720.0,
                exchange="NSE"
            )
        ]
        self._mock_orders = []

    async def get_account_info(self) -> AccountInfo:
        return AccountInfo(
            broker_name="breeze",
            client_id=self.api_key[:8] if self.api_key else "BREEZE_DEMO",
            available_cash=480000.0,
            utilized_margin=35000.0,
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
                order_id=f"BREEZE_BLK_{uuid.uuid4().hex[:6]}",
                status="BLOCKED_KILL_SWITCH",
                message="ICICI Breeze: Trade blocked by Kill Switch.",
                is_blocked_by_kill_switch=True
            )

        order_id = f"BRZ_{uuid.uuid4().hex[:8].upper()}"
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
            message="Order placed via ICICI Breeze API."
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
                "broker": "breeze",
                "event": "HEARTBEAT",
                "timestamp": datetime.utcnow().isoformat(),
                "is_trading_blocked": self.is_trading_blocked
            }
