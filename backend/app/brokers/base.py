from abc import ABC, abstractmethod
from typing import List, Optional, AsyncGenerator, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class Position(BaseModel):
    symbol: str
    product_type: str = "INTRADAY"  # INTRADAY / CNC / MIS / NRML
    quantity: float
    buy_price: float
    current_price: float
    pnl: float
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    exchange: str = "NSE"
    instrument_token: Optional[str] = None
    last_updated: Optional[datetime] = None

class Order(BaseModel):
    order_id: str
    broker_order_id: Optional[str] = None
    symbol: str
    order_type: str = "MARKET"  # MARKET, LIMIT, SL, SL-M
    transaction_type: str = "BUY"  # BUY, SELL
    quantity: float
    filled_quantity: float = 0.0
    price: float = 0.0
    trigger_price: Optional[float] = None
    status: str = "OPEN"  # OPEN, COMPLETE, CANCELLED, REJECTED, BLOCKED_KILL_SWITCH
    order_timestamp: datetime = Field(default_factory=datetime.utcnow)
    rejection_reason: Optional[str] = None
    tag: Optional[str] = None

class OrderRequest(BaseModel):
    symbol: str
    transaction_type: str  # BUY or SELL
    order_type: str = "MARKET"  # MARKET, LIMIT, SL, SL-M
    quantity: float
    price: float = 0.0
    trigger_price: Optional[float] = None
    product_type: str = "INTRADAY"
    tag: Optional[str] = None
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    order_id: str
    status: str  # SUBMITTED, REJECTED, BLOCKED_KILL_SWITCH, FILLED
    message: str
    broker_order_id: Optional[str] = None
    is_blocked_by_kill_switch: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AccountInfo(BaseModel):
    broker_name: str
    client_id: str
    available_cash: float
    utilized_margin: float = 0.0
    total_collateral: float = 0.0
    currency: str = "INR"
    is_live: bool = False
    connected_at: datetime = Field(default_factory=datetime.utcnow)

class BrokerTrade(BaseModel):
    trade_id: str
    order_id: str
    symbol: str
    transaction_type: str  # BUY or SELL
    quantity: float
    execution_price: float
    timestamp: datetime
    pnl: Optional[float] = None
    value: float = 0.0

class BrokerAdapter(ABC):
    """
    Unified abstract interface for all broker adapters.
    Ensures identical rules engine and kill switch intervention behavior across all brokers.
    """
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.trader_id = config.get("trader_id", "trader_alpha")
        self.broker_name = config.get("broker_name", "generic")
        self.is_connected = False
        self.is_trading_blocked = False

    @abstractmethod
    async def get_positions(self) -> List[Position]:
        """Fetch current open positions from the broker."""
        pass

    @abstractmethod
    async def get_order_history(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[Order]:
        """Fetch order book / order history."""
        pass

    @abstractmethod
    async def get_trades(self, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None) -> List[BrokerTrade]:
        """Fetch executed trades (trade book)."""
        pass

    @abstractmethod
    async def place_order(self, order: OrderRequest) -> OrderResponse:
        """Submit an order to the broker (subject to Kill Switch interceptor)."""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order with the broker."""
        pass

    @abstractmethod
    async def block_trading(self) -> bool:
        """
        Engages the kill switch action at broker level:
        - Cancels all pending orders
        - Optionally squares off positions
        - Flags trading as blocked
        """
        pass

    @abstractmethod
    async def get_account_info(self) -> AccountInfo:
        """Fetch account balances, margins, and connectivity status."""
        pass

    @abstractmethod
    async def stream_order_updates(self) -> AsyncGenerator[Dict[str, Any], None]:
        """WebSocket or real-time event generator streaming live order/trade events."""
        pass
