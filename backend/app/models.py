import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    trader_id = Column(String(64), index=True, nullable=False)
    session_id = Column(String(64), index=True, nullable=False)
    instrument = Column(String(32), index=True, nullable=False)
    trade_type = Column(String(16), nullable=False)  # "long" or "short"
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    position_size = Column(Float, nullable=False)
    pnl = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    duration_seconds = Column(Integer, default=60, nullable=False)
    
    # Optional market context attributes for FOMO/Boredom rules
    atr = Column(Float, default=1.0, nullable=True)
    extension_ratio = Column(Float, default=0.0, nullable=True)  # e.g. 0.75 for 75% extended
    setup_pattern = Column(String(64), default="BREAKOUT", nullable=True)  # "BREAKOUT", "PULLBACK", "REVERSAL", "NONE", "CHOP"
    notes = Column(String(255), nullable=True)

    # Relationships
    tilt_events = relationship("TiltEvent", back_populates="trade", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "session_id": self.session_id,
            "instrument": self.instrument,
            "trade_type": self.trade_type,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "position_size": self.position_size,
            "pnl": self.pnl,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "duration_seconds": self.duration_seconds,
            "atr": self.atr,
            "extension_ratio": self.extension_ratio,
            "setup_pattern": self.setup_pattern,
            "notes": self.notes
        }

class TiltEvent(Base):
    __tablename__ = "tilt_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    trader_id = Column(String(64), index=True, nullable=False)
    session_id = Column(String(64), index=True, nullable=False)
    event_type = Column(String(64), index=True, nullable=False)
    points_added = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    trade_id = Column(Integer, ForeignKey("trades.id", ondelete="SET NULL"), nullable=True)
    metadata_json = Column(Text, default="{}", nullable=False)

    trade = relationship("Trade", back_populates="tilt_events")

    def get_metadata(self):
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except Exception:
            return {}

    def set_metadata(self, data: dict):
        self.metadata_json = json.dumps(data)

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "session_id": self.session_id,
            "event_type": self.event_type,
            "points_added": self.points_added,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "trade_id": self.trade_id,
            "metadata": self.get_metadata()
        }

class TiltScoreModel(Base):
    __tablename__ = "tilt_scores"

    trader_id = Column(String(64), primary_key=True, index=True)
    session_id = Column(String(64), nullable=False)
    current_score = Column(Integer, default=0, nullable=False)
    status = Column(String(16), default="green", nullable=False)  # green, yellow, orange, red
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False)
    soft_lock_active = Column(Boolean, default=False)
    soft_lock_until = Column(DateTime, nullable=True)
    hard_lock_active = Column(Boolean, default=False)
    hard_lock_until = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "trader_id": self.trader_id,
            "session_id": self.session_id,
            "current_score": self.current_score,
            "status": self.status,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "soft_lock_active": self.soft_lock_active,
            "soft_lock_until": self.soft_lock_until.isoformat() if self.soft_lock_until else None,
            "hard_lock_active": self.hard_lock_active,
            "hard_lock_until": self.hard_lock_until.isoformat() if self.hard_lock_until else None
        }

class TraderBaseline(Base):
    __tablename__ = "trader_baselines"

    trader_id = Column(String(64), primary_key=True, index=True)
    avg_position_size = Column(Float, default=100.0, nullable=False)
    avg_trades_per_hour = Column(Float, default=3.0, nullable=False)
    preferred_instruments_json = Column(Text, default='["NQ", "ES", "AAPL", "NVDA", "TSLA"]', nullable=False)
    active_session_hours = Column(String(64), default="09:30-16:00", nullable=False)  # "HH:MM-HH:MM"
    avg_win_rate = Column(Float, default=0.55, nullable=False)
    avg_loss_rate = Column(Float, default=0.45, nullable=False)
    hard_lock_cooldown_minutes = Column(Integer, default=30, nullable=False)
    soft_lock_cooldown_seconds = Column(Integer, default=60, nullable=False)
    last_calculated = Column(DateTime, default=datetime.utcnow, nullable=False)

    def get_preferred_instruments(self):
        try:
            return json.loads(self.preferred_instruments_json) if self.preferred_instruments_json else []
        except Exception:
            return ["NQ", "ES", "AAPL"]

    def set_preferred_instruments(self, instruments: list):
        self.preferred_instruments_json = json.dumps(instruments)

    def to_dict(self):
        return {
            "trader_id": self.trader_id,
            "avg_position_size": self.avg_position_size,
            "avg_trades_per_hour": self.avg_trades_per_hour,
            "preferred_instruments": self.get_preferred_instruments(),
            "active_session_hours": self.active_session_hours,
            "avg_win_rate": self.avg_win_rate,
            "avg_loss_rate": self.avg_loss_rate,
            "hard_lock_cooldown_minutes": self.hard_lock_cooldown_minutes,
            "soft_lock_cooldown_seconds": self.soft_lock_cooldown_seconds,
            "last_calculated": self.last_calculated.isoformat() if self.last_calculated else None
        }

class KillSwitchAction(Base):
    __tablename__ = "kill_switch_actions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    trader_id = Column(String(64), index=True, nullable=False)
    session_id = Column(String(64), index=True, nullable=False)
    action_type = Column(String(32), nullable=False)  # warning, soft_lock, hard_lock, reset, override
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    tilt_score_at_trigger = Column(Integer, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    override_reason = Column(Text, nullable=True)
    metadata_json = Column(Text, default="{}", nullable=False)

    def get_metadata(self):
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except Exception:
            return {}

    def set_metadata(self, data: dict):
        self.metadata_json = json.dumps(data)

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "session_id": self.session_id,
            "action_type": self.action_type,
            "triggered_at": self.triggered_at.isoformat() if self.triggered_at else None,
            "tilt_score_at_trigger": self.tilt_score_at_trigger,
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "override_reason": self.override_reason,
            "metadata": self.get_metadata()
        }

class TradingSession(Base):
    __tablename__ = "trading_sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    trader_id = Column(String(64), index=True, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "session_id": self.session_id,
            "trader_id": self.trader_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "is_active": self.is_active,
            "notes": self.notes
        }

class BrokerConfig(Base):
    __tablename__ = "broker_configs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    trader_id = Column(String(64), index=True, nullable=False)
    broker_name = Column(String(32), index=True, nullable=False)  # dhan, zerodha, fyers, upstox, angelone, breeze
    client_id_encrypted = Column(Text, default="", nullable=False)
    api_key_encrypted = Column(Text, default="", nullable=False)
    secret_key_encrypted = Column(Text, default="", nullable=False)
    access_token_encrypted = Column(Text, default="", nullable=False)
    pin_totp_encrypted = Column(Text, default="", nullable=False)
    token_expiry = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    is_sandbox = Column(Boolean, default=False, nullable=False)
    currency_code = Column(String(16), default="INR", nullable=False)
    currency_symbol = Column(String(16), default="₹", nullable=False)
    locale = Column(String(16), default="en-IN", nullable=False)
    last_sync_at = Column(DateTime, nullable=True)
    webhook_url = Column(String(255), nullable=True)
    settings_json = Column(Text, default='{"auto_cancel_orders_on_lock": true, "auto_square_off_on_lock": false, "sync_interval_seconds": 30}', nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def get_settings(self):
        try:
            return json.loads(self.settings_json) if self.settings_json else {}
        except Exception:
            return {"auto_cancel_orders_on_lock": True, "auto_square_off_on_lock": False, "sync_interval_seconds": 30}

    def set_settings(self, settings: dict):
        self.settings_json = json.dumps(settings)

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "broker_name": self.broker_name,
            "token_expiry": self.token_expiry.isoformat() if self.token_expiry else None,
            "is_active": self.is_active,
            "is_sandbox": self.is_sandbox,
            "currency_code": self.currency_code,
            "currency_symbol": self.currency_symbol,
            "locale": self.locale,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "webhook_url": self.webhook_url,
            "settings": self.get_settings(),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
