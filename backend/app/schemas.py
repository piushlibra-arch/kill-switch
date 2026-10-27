from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class TradeCreate(BaseModel):
    trader_id: str = "trader_alpha"
    session_id: Optional[str] = None
    instrument: str = Field(...)
    trade_type: str = Field(...)  # "long" or "short"
    entry_price: float = Field(...)
    exit_price: float = Field(...)
    position_size: float = Field(...)
    pnl: float = Field(...)
    timestamp: Optional[datetime] = None
    duration_seconds: int = Field(default=120)
    
    # Market context for rules
    atr: float = Field(default=1.0)
    extension_ratio: float = Field(default=0.0)
    setup_pattern: str = Field(default="BREAKOUT")
    notes: Optional[str] = None
    
    # Intervention confirmations
    soft_lock_confirmed_text: Optional[str] = None
    override_reason: Optional[str] = None

class TiltEventResponse(BaseModel):
    id: Optional[int] = None
    trader_id: str
    session_id: str
    event_type: str
    points_added: int
    timestamp: datetime
    trade_id: Optional[int] = None
    metadata: Dict[str, Any] = {}

class TradeResponse(BaseModel):
    id: int
    trader_id: str
    session_id: str
    instrument: str
    trade_type: str
    entry_price: float
    exit_price: float
    position_size: float
    pnl: float
    timestamp: datetime
    duration_seconds: int
    atr: Optional[float] = 1.0
    extension_ratio: Optional[float] = 0.0
    setup_pattern: Optional[str] = "BREAKOUT"
    notes: Optional[str] = None
    triggered_events: List[TiltEventResponse] = []
    current_tilt_score: int
    tilt_status: str
    action_required: Optional[str] = None  # None, "warning", "soft_lock", "hard_lock"
    message: Optional[str] = None

class TiltScoreResponse(BaseModel):
    trader_id: str
    session_id: str
    current_score: int
    status: str  # green, yellow, orange, red
    last_updated: datetime
    soft_lock_active: bool
    soft_lock_remaining_seconds: int = 0
    hard_lock_active: bool
    hard_lock_remaining_minutes: int = 0
    events: List[TiltEventResponse] = []

class BaselineResponse(BaseModel):
    trader_id: str
    avg_position_size: float
    avg_trades_per_hour: float
    preferred_instruments: List[str]
    active_session_hours: str
    avg_win_rate: float
    avg_loss_rate: float
    hard_lock_cooldown_minutes: int
    soft_lock_cooldown_seconds: int
    last_calculated: Optional[datetime] = None

class BaselineUpdate(BaseModel):
    avg_position_size: Optional[float] = None
    avg_trades_per_hour: Optional[float] = None
    preferred_instruments: Optional[List[str]] = None
    active_session_hours: Optional[str] = None
    hard_lock_cooldown_minutes: Optional[int] = None
    soft_lock_cooldown_seconds: Optional[int] = None

class KillSwitchOverrideRequest(BaseModel):
    trader_id: str = "trader_alpha"
    override_reason: str = Field(..., min_length=5)

class KillSwitchResetRequest(BaseModel):
    trader_id: str = "trader_alpha"
    reason: str = Field(..., min_length=3)

class SoftLockAcknowledgeRequest(BaseModel):
    trader_id: str = "trader_alpha"
    confirmation_phrase: str = Field(...)

class SessionStartRequest(BaseModel):
    trader_id: str = "trader_alpha"
    session_id: Optional[str] = None
    notes: Optional[str] = None

class SessionEndRequest(BaseModel):
    trader_id: str = "trader_alpha"
    notes: Optional[str] = None

class SessionSummaryResponse(BaseModel):
    session_id: str
    trader_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    is_active: bool
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    peak_tilt_score: int
    revenge_trades_count: int
    estimated_revenge_pnl_loss: float
    emotional_trades: List[Dict[str, Any]] = []
    suggestions: List[str] = []

class RuleTriggerStat(BaseModel):
    rule_name: str
    display_name: str
    count: int
    total_points: int
    color: str

class HeatmapHourStat(BaseModel):
    hour: int
    label: str
    trade_count: int
    tilt_points: int
    avg_score: float

class TimelinePoint(BaseModel):
    timestamp: datetime
    score: int
    trade_id: Optional[int] = None
    pnl: Optional[float] = None
    event_type: Optional[str] = None

class AnalyticsResponse(BaseModel):
    session_id: str
    trader_id: str
    total_trades: int
    win_rate: float
    total_pnl: float
    current_score: int
    peak_score: int
    rule_breakdown: List[RuleTriggerStat]
    revenge_trades_history: List[Dict[str, Any]]
    timeline: List[TimelinePoint]
    pattern_heatmap: List[HeatmapHourStat]
