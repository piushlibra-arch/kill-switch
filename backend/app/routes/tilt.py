from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import TiltEvent, TradingSession
from backend.app.schemas import TiltScoreResponse, TiltEventResponse
from backend.app.state_manager import state_manager

router = APIRouter(prefix="/api", tags=["tilt"])

@router.get("/tilt-score/{trader_id}", response_model=TiltScoreResponse)
async def get_tilt_score(trader_id: str, db: AsyncSession = Depends(get_db)):
    state = state_manager.get_or_create_state(trader_id)
    now = datetime.utcnow()
    
    # Calculate remaining soft lock seconds
    soft_rem_sec = 0
    if state.get("soft_lock_active") and state.get("soft_lock_until"):
        delta = (state["soft_lock_until"] - now).total_seconds()
        soft_rem_sec = max(0, int(delta))
        if soft_rem_sec == 0:
            state["soft_lock_active"] = False

    # Calculate remaining hard lock minutes
    hard_rem_min = 0
    if state.get("hard_lock_active") and state.get("hard_lock_until"):
        delta = (state["hard_lock_until"] - now).total_seconds()
        hard_rem_min = max(0, int(delta / 60))
    
    # Fetch recent events from DB for this session
    session_id = state.get("session_id")
    events_stmt = select(TiltEvent).where(
        TiltEvent.trader_id == trader_id,
        TiltEvent.session_id == session_id
    ).order_by(TiltEvent.timestamp.desc()).limit(20)
    res = await db.execute(events_stmt)
    db_events = res.scalars().all()
    
    event_responses = [
        TiltEventResponse(
            id=e.id,
            trader_id=e.trader_id,
            session_id=e.session_id,
            event_type=e.event_type,
            points_added=e.points_added,
            timestamp=e.timestamp,
            trade_id=e.trade_id,
            metadata=e.get_metadata()
        )
        for e in db_events
    ]
    
    return TiltScoreResponse(
        trader_id=state["trader_id"],
        session_id=state["session_id"],
        current_score=state["current_score"],
        status=state["status"],
        last_updated=state["last_updated"],
        soft_lock_active=state.get("soft_lock_active", False),
        soft_lock_remaining_seconds=soft_rem_sec,
        hard_lock_active=state.get("hard_lock_active", False),
        hard_lock_remaining_minutes=hard_rem_min,
        events=event_responses
    )

@router.get("/tilt-events/{trader_id}", response_model=List[TiltEventResponse])
async def get_tilt_events(trader_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    state = state_manager.get_or_create_state(trader_id)
    session_id = state.get("session_id")
    
    stmt = select(TiltEvent).where(
        TiltEvent.trader_id == trader_id
    ).order_by(TiltEvent.timestamp.desc()).limit(limit)
    res = await db.execute(stmt)
    events = res.scalars().all()
    
    return [
        TiltEventResponse(
            id=e.id,
            trader_id=e.trader_id,
            session_id=e.session_id,
            event_type=e.event_type,
            points_added=e.points_added,
            timestamp=e.timestamp,
            trade_id=e.trade_id,
            metadata=e.get_metadata()
        )
        for e in events
    ]
