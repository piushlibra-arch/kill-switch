import json
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models import TraderBaseline, TradingSession, Trade, TiltEvent
from backend.app.rules_engine import RULE_DEFINITIONS

async def seed_initial_data(db: AsyncSession, trader_id: str = "trader_alpha"):
    # 1. Check if baseline exists
    stmt = select(TraderBaseline).where(TraderBaseline.trader_id == trader_id)
    res = await db.execute(stmt)
    baseline = res.scalars().first()
    
    if not baseline:
        baseline = TraderBaseline(
            trader_id=trader_id,
            avg_position_size=100.0,
            avg_trades_per_hour=3.0,
            preferred_instruments_json=json.dumps(["NQ", "ES", "AAPL", "NVDA", "TSLA"]),
            active_session_hours="09:30-16:00",
            avg_win_rate=0.55,
            avg_loss_rate=0.45,
            hard_lock_cooldown_minutes=30,
            soft_lock_cooldown_seconds=60,
            last_calculated=datetime.utcnow()
        )
        db.add(baseline)
        await db.commit()

    # 2. Check if any session exists
    sess_stmt = select(TradingSession).where(TradingSession.trader_id == trader_id)
    s_res = await db.execute(sess_stmt)
    existing_session = s_res.scalars().first()

    if not existing_session:
        now = datetime.utcnow()
        session_id = "sess_live_alpha"
        session = TradingSession(
            session_id=session_id,
            trader_id=trader_id,
            started_at=now - timedelta(hours=2),
            is_active=True,
            notes="Morning High Volatility Session"
        )
        db.add(session)
        await db.commit()

        # Add 3 initial sample trades to show starting history
        t1 = Trade(
            trader_id=trader_id,
            session_id=session_id,
            instrument="NQ",
            trade_type="long",
            entry_price=18150.0,
            exit_price=18210.0,
            position_size=100.0,
            pnl=600.0,
            timestamp=now - timedelta(minutes=50),
            duration_seconds=180,
            atr=1.2,
            extension_ratio=0.3,
            setup_pattern="BREAKOUT",
            notes="Clean morning opening range breakout"
        )
        db.add(t1)

        t2 = Trade(
            trader_id=trader_id,
            session_id=session_id,
            instrument="ES",
            trade_type="short",
            entry_price=5120.0,
            exit_price=5132.0,
            position_size=100.0,
            pnl=-300.0,
            timestamp=now - timedelta(minutes=25),
            duration_seconds=90,
            atr=1.1,
            extension_ratio=0.4,
            setup_pattern="PULLBACK",
            notes="Stop hit at VWAP reclaim"
        )
        db.add(t2)
        await db.commit()
        await db.refresh(t2)

        # Seed TiltEvent for t2 loss
        ev1 = TiltEvent(
            trader_id=trader_id,
            session_id=session_id,
            event_type="LOSS_OCCURRED",
            points_added=10,
            timestamp=now - timedelta(minutes=25),
            trade_id=t2.id,
            metadata_json=json.dumps({"pnl": -300.0, "instrument": "ES"})
        )
        db.add(ev1)
        await db.commit()
