import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import Trade, TiltEvent, TraderBaseline, KillSwitchAction, TradingSession
from backend.app.schemas import TradeCreate, TradeResponse, TiltEventResponse
from backend.app.rules_engine import RulesEngine
from backend.app.state_manager import state_manager
from backend.app.routes.baseline import get_or_create_baseline
from backend.app.brokers.manager import broker_manager

router = APIRouter(prefix="/api/trades", tags=["trades"])

@router.post("", response_model=TradeResponse)
async def submit_trade(trade_in: TradeCreate, db: AsyncSession = Depends(get_db)):
    trader_id = trade_in.trader_id
    trade_time = trade_in.timestamp or datetime.utcnow()
    
    # 1. Determine active session
    state = state_manager.get_or_create_state(trader_id, trade_in.session_id)
    session_id = trade_in.session_id or state.get("session_id")
    
    # Check session in DB or create
    sess_stmt = select(TradingSession).where(TradingSession.session_id == session_id)
    sess_res = await db.execute(sess_stmt)
    active_session = sess_res.scalar_one_or_none()
    if not active_session:
        active_session = TradingSession(
            session_id=session_id,
            trader_id=trader_id,
            started_at=trade_time,
            is_active=True,
            notes="Active trading session"
        )
        db.add(active_session)
        await db.commit()
    
    # 2. Check Intervention Locks
    # If trader passed an override reason while hard locked, apply override
    if state.get("hard_lock_active") and trade_in.override_reason:
        state_manager.override_lock(trader_id, trade_in.override_reason)
        # Log KillSwitchAction
        action_log = KillSwitchAction(
            trader_id=trader_id,
            session_id=session_id,
            action_type="override",
            triggered_at=datetime.utcnow(),
            tilt_score_at_trigger=state["current_score"],
            override_reason=trade_in.override_reason,
            metadata_json=json.dumps({"trade_instrument": trade_in.instrument})
        )
        db.add(action_log)
        await db.commit()

    allowed, block_type, reason_msg = state_manager.check_trade_allowed(
        trader_id,
        trade_in.soft_lock_confirmed_text
    )
    
    if not allowed:
        # Trade is blocked by intervention system!
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "block_type": block_type,
                "message": reason_msg,
                "current_score": state["current_score"],
                "status": state["status"]
            }
        )

    # 3. Create and persist Trade record
    trade = Trade(
        trader_id=trader_id,
        session_id=session_id,
        instrument=trade_in.instrument.upper(),
        trade_type=trade_in.trade_type.lower(),
        entry_price=trade_in.entry_price,
        exit_price=trade_in.exit_price,
        position_size=trade_in.position_size,
        pnl=trade_in.pnl,
        timestamp=trade_time,
        duration_seconds=trade_in.duration_seconds,
        atr=trade_in.atr,
        extension_ratio=trade_in.extension_ratio,
        setup_pattern=trade_in.setup_pattern,
        notes=trade_in.notes
    )
    db.add(trade)
    await db.flush()  # assign trade.id

    # 4. Fetch trader baseline and prior trades in this session
    baseline = await get_or_create_baseline(trader_id, db)
    
    prior_trades_stmt = select(Trade).where(
        Trade.trader_id == trader_id,
        Trade.session_id == session_id,
        Trade.id != trade.id
    ).order_by(Trade.timestamp.asc())
    prior_res = await db.execute(prior_trades_stmt)
    prior_trades = prior_res.scalars().all()

    # Get last event time for cooldown check
    last_event_stmt = select(TiltEvent).where(
        TiltEvent.trader_id == trader_id
    ).order_by(TiltEvent.timestamp.desc()).limit(1)
    last_ev_res = await db.execute(last_event_stmt)
    last_ev = last_ev_res.scalar_one_or_none()
    last_event_time = last_ev.timestamp if last_ev else None

    # 5. Evaluate Rules Engine!
    rules_engine = RulesEngine(baseline)
    current_score = state.get("current_score", 0)
    triggered_events, new_score, new_status = rules_engine.evaluate_trade(
        current_trade=trade,
        prior_trades=prior_trades,
        current_score=current_score,
        last_event_time=last_event_time
    )

    # 6. Save TiltEvents to DB
    saved_events: List[TiltEventResponse] = []
    for ev in triggered_events:
        db_ev = TiltEvent(
            trader_id=trader_id,
            session_id=session_id,
            event_type=ev["event_type"],
            points_added=ev["points_added"],
            timestamp=trade_time,
            trade_id=trade.id,
            metadata_json=json.dumps(ev.get("metadata", {}))
        )
        db.add(db_ev)
        await db.flush()
        saved_events.append(TiltEventResponse(
            id=db_ev.id,
            trader_id=trader_id,
            session_id=session_id,
            event_type=db_ev.event_type,
            points_added=db_ev.points_added,
            timestamp=db_ev.timestamp,
            trade_id=trade.id,
            metadata=ev.get("metadata", {})
        ))

    # 7. Check if new score triggers KillSwitchAction (warning, soft_lock, hard_lock)
    action_required: Optional[str] = None
    if new_status == "yellow" and state.get("status") == "green":
        action_required = "warning"
        db.add(KillSwitchAction(
            trader_id=trader_id,
            session_id=session_id,
            action_type="warning",
            triggered_at=datetime.utcnow(),
            tilt_score_at_trigger=new_score,
            metadata_json=json.dumps({"trade_id": trade.id, "rules": [e.event_type for e in saved_events]})
        ))
    elif new_status == "orange" and state.get("status") in ["green", "yellow"]:
        action_required = "soft_lock"
        db.add(KillSwitchAction(
            trader_id=trader_id,
            session_id=session_id,
            action_type="soft_lock",
            triggered_at=datetime.utcnow(),
            tilt_score_at_trigger=new_score,
            metadata_json=json.dumps({"trade_id": trade.id, "cooldown_seconds": baseline.soft_lock_cooldown_seconds})
        ))
    elif new_status == "red" and state.get("status") != "red":
        action_required = "hard_lock"
        db.add(KillSwitchAction(
            trader_id=trader_id,
            session_id=session_id,
            action_type="hard_lock",
            triggered_at=datetime.utcnow(),
            tilt_score_at_trigger=new_score,
            metadata_json=json.dumps({"trade_id": trade.id, "cooldown_minutes": baseline.hard_lock_cooldown_minutes})
        ))
        # Trigger broker-level cancellation & square-off
        await broker_manager.execute_kill_switch_broker_action(
            trader_id=trader_id,
            db=db,
            tilt_score=new_score,
            session_id=session_id,
            auto_square_off=False
        )

    await db.commit()
    await db.refresh(trade)

    # 8. Update in-memory state
    latest_event_dict = saved_events[0].model_dump() if saved_events else None
    updated_state = state_manager.update_score(
        trader_id=trader_id,
        new_score=new_score,
        status=new_status,
        session_id=session_id,
        event=latest_event_dict,
        soft_lock_wait_sec=baseline.soft_lock_cooldown_seconds,
        hard_lock_cooldown_min=baseline.hard_lock_cooldown_minutes
    )

    # 9. Real-time WebSocket broadcast
    ws_payload = {
        "type": "TILT_SCORE_UPDATE",
        "trader_id": trader_id,
        "session_id": session_id,
        "current_score": new_score,
        "status": new_status,
        "action_required": action_required,
        "triggered_events": [e.model_dump() for e in saved_events],
        "latest_trade": trade.to_dict(),
        "soft_lock_active": updated_state.get("soft_lock_active", False),
        "hard_lock_active": updated_state.get("hard_lock_active", False),
        "timestamp": trade_time.isoformat()
    }
    await state_manager.broadcast_tilt_update(trader_id, ws_payload)

    # 10. Formulate friendly message
    msg = f"Trade recorded. Tilt score: {new_score} ({new_status.upper()})."
    if action_required == "warning":
        msg = f"⚠️ Warning: Tilt score elevated to {new_score}. Exercise emotional caution."
    elif action_required == "soft_lock":
        msg = f"🟠 Soft Lock Engaged! Mandatory 60s cooldown or 'I confirm this trade' phrase required before next execution."
    elif action_required == "hard_lock":
        msg = f"🛑 HARD KILL SWITCH TRIGGERED! Tilt score reached {new_score}. Session locked for 30 minutes minimum."

    return TradeResponse(
        id=trade.id,
        trader_id=trade.trader_id,
        session_id=trade.session_id,
        instrument=trade.instrument,
        trade_type=trade.trade_type,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        position_size=trade.position_size,
        pnl=trade.pnl,
        timestamp=trade.timestamp,
        duration_seconds=trade.duration_seconds,
        atr=trade.atr,
        extension_ratio=trade.extension_ratio,
        setup_pattern=trade.setup_pattern,
        notes=trade.notes,
        triggered_events=saved_events,
        current_tilt_score=new_score,
        tilt_status=new_status,
        action_required=action_required,
        message=msg
    )

@router.get("/{trader_id}", response_model=List[dict])
async def get_trades(trader_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    stmt = select(Trade).where(Trade.trader_id == trader_id).order_by(Trade.timestamp.desc()).limit(limit)
    res = await db.execute(stmt)
    trades = res.scalars().all()
    return [t.to_dict() for t in trades]
