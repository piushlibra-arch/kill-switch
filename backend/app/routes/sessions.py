from datetime import datetime
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from backend.app.database import get_db
from backend.app.models import TradingSession, Trade, TiltEvent
from backend.app.schemas import SessionStartRequest, SessionEndRequest, SessionSummaryResponse
from backend.app.state_manager import state_manager

router = APIRouter(prefix="/api/session", tags=["session"])

@router.post("/start", response_model=Dict[str, Any])
async def start_session(req: SessionStartRequest, db: AsyncSession = Depends(get_db)):
    trader_id = req.trader_id
    now = datetime.utcnow()
    
    # End any currently active session
    stmt = select(TradingSession).where(
        TradingSession.trader_id == trader_id,
        TradingSession.is_active == True
    )
    res = await db.execute(stmt)
    active_sessions = res.scalars().all()
    for s in active_sessions:
        s.is_active = False
        s.ended_at = now
    
    session_id = req.session_id or f"sess_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    new_session = TradingSession(
        session_id=session_id,
        trader_id=trader_id,
        started_at=now,
        is_active=True,
        notes=req.notes or "Trading session initiated"
    )
    db.add(new_session)
    await db.commit()
    
    # Reset in-memory tilt score and locks for new session
    state_manager.reset_session(trader_id, session_id)
    
    # Broadcast reset to WS clients
    await state_manager.broadcast_tilt_update(trader_id, {
        "type": "SESSION_STARTED",
        "session_id": session_id,
        "score": 0,
        "status": "green",
        "message": "New trading session started. Tilt score reset to 0."
    })
    
    return {
        "status": "success",
        "session_id": session_id,
        "trader_id": trader_id,
        "started_at": now.isoformat(),
        "is_active": True
    }

@router.post("/end", response_model=SessionSummaryResponse)
async def end_session(req: SessionEndRequest, db: AsyncSession = Depends(get_db)):
    trader_id = req.trader_id
    now = datetime.utcnow()
    
    stmt = select(TradingSession).where(
        TradingSession.trader_id == trader_id,
        TradingSession.is_active == True
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    
    if not session:
        # Check most recent session
        stmt_recent = select(TradingSession).where(TradingSession.trader_id == trader_id).order_by(TradingSession.started_at.desc())
        res_recent = await db.execute(stmt_recent)
        session = res_recent.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="No active or past session found.")
    
    session.is_active = False
    session.ended_at = now
    if req.notes:
        session.notes = (session.notes or "") + " | Post-session notes: " + req.notes
    await db.commit()
    
    summary = await generate_session_summary(session.session_id, trader_id, db)
    
    await state_manager.broadcast_tilt_update(trader_id, {
        "type": "SESSION_ENDED",
        "session_id": session.session_id,
        "summary": summary.model_dump()
    })
    
    return summary

@router.get("/current/{trader_id}")
async def get_current_session(trader_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(TradingSession).where(
        TradingSession.trader_id == trader_id,
        TradingSession.is_active == True
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    
    if not session:
        # Create an auto session if none active
        now = datetime.utcnow()
        session_id = f"sess_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session = TradingSession(
            session_id=session_id,
            trader_id=trader_id,
            started_at=now,
            is_active=True,
            notes="Default auto session"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        state_manager.get_or_create_state(trader_id, session_id)
        
    return session.to_dict()

@router.get("/summary/{session_id}", response_model=SessionSummaryResponse)
async def get_session_summary_endpoint(session_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(TradingSession).where(TradingSession.session_id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return await generate_session_summary(session.session_id, session.trader_id, db)

async def generate_session_summary(session_id: str, trader_id: str, db: AsyncSession) -> SessionSummaryResponse:
    # Fetch session
    sess_stmt = select(TradingSession).where(TradingSession.session_id == session_id)
    sess_res = await db.execute(sess_stmt)
    session = sess_res.scalar_one_or_none()
    started_at = session.started_at if session else datetime.utcnow()
    ended_at = session.ended_at if session else datetime.utcnow()
    is_active = session.is_active if session else False

    # Fetch trades
    trades_stmt = select(Trade).where(Trade.session_id == session_id).order_by(Trade.timestamp.asc())
    trades_res = await db.execute(trades_stmt)
    trades = trades_res.scalars().all()
    
    # Fetch tilt events
    events_stmt = select(TiltEvent).where(TiltEvent.session_id == session_id).order_by(TiltEvent.timestamp.asc())
    events_res = await db.execute(events_stmt)
    events = events_res.scalars().all()
    
    total_trades = len(trades)
    winning_trades = len([t for t in trades if t.pnl > 0])
    losing_trades = len([t for t in trades if t.pnl < 0])
    total_pnl = round(sum(t.pnl for t in trades), 2)
    win_rate = round(winning_trades / total_trades, 2) if total_trades > 0 else 0.0

    # Find revenge & emotional trades
    revenge_trade_ids = set()
    emotional_trade_ids = set()
    for ev in events:
        if ev.trade_id:
            emotional_trade_ids.add(ev.trade_id)
        if ev.event_type in ["REVENGE_REENTRY", "SIZE_ESCALATION", "FOMO_CHASE"]:
            if ev.trade_id:
                revenge_trade_ids.add(ev.trade_id)

    emotional_trades_list = []
    revenge_pnl_lost = 0.0
    for t in trades:
        if t.id in emotional_trade_ids:
            trade_evs = [e.event_type for e in events if e.trade_id == t.id]
            is_revenge = t.id in revenge_trade_ids
            if is_revenge and t.pnl < 0:
                revenge_pnl_lost += abs(t.pnl)
            
            emotional_trades_list.append({
                "trade_id": t.id,
                "instrument": t.instrument,
                "trade_type": t.trade_type,
                "pnl": t.pnl,
                "position_size": t.position_size,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "triggered_rules": trade_evs,
                "is_revenge": is_revenge
            })

    # Peak score from state or calculated
    state = state_manager.get_or_create_state(trader_id, session_id)
    peak_score = state.get("peak_score", 0)

    # Coaching suggestions based on triggered rules
    suggestions = []
    rule_types = [e.event_type for e in events]
    if "REVENGE_REENTRY" in rule_types:
        suggestions.append("Enforce a mandatory 5-minute break after taking any stop-out to let adrenaline normalize.")
    if "SIZE_ESCALATION" in rule_types:
        suggestions.append("Fix your maximum position sizing to your baseline standard; martingale sizing after losses degrades account expectancy.")
    if "OUTSIDE_SESSION" in rule_types:
        suggestions.append("Limit execution strictly to your high-volume market open and core session hours.")
    if "FOMO_CHASE" in rule_types:
        suggestions.append("Avoid market order chasing on extended bars; wait for retracements to the 20 EMA or VWAP.")
    if "SAME_TICKER_FIXATION" in rule_types:
        suggestions.append("When a ticker acts erratically, step back and scan other high-probability setups instead of over-concentrating.")
    if not suggestions:
        suggestions.append("Disciplined session! Sizing and emotional control remained well within baseline guardrails.")

    return SessionSummaryResponse(
        session_id=session_id,
        trader_id=trader_id,
        started_at=started_at,
        ended_at=ended_at,
        is_active=is_active,
        total_trades=total_trades,
        winning_trades=winning_trades,
        losing_trades=losing_trades,
        win_rate=win_rate,
        total_pnl=total_pnl,
        peak_tilt_score=peak_score,
        revenge_trades_count=len(revenge_trade_ids),
        estimated_revenge_pnl_loss=round(revenge_pnl_lost, 2),
        emotional_trades=emotional_trades_list,
        suggestions=suggestions
    )
