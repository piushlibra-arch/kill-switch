import json
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database import get_db
from backend.app.models import KillSwitchAction
from backend.app.schemas import KillSwitchOverrideRequest, KillSwitchResetRequest, SoftLockAcknowledgeRequest
from backend.app.state_manager import state_manager

router = APIRouter(prefix="/api/kill-switch", tags=["kill-switch"])

@router.post("/override")
async def override_kill_switch(req: KillSwitchOverrideRequest, db: AsyncSession = Depends(get_db)):
    trader_id = req.trader_id
    state = state_manager.get_or_create_state(trader_id)
    prev_score = state["current_score"]
    
    # Override in state manager
    updated_state = state_manager.override_lock(trader_id, req.override_reason)
    
    # Log KillSwitchAction to DB
    action = KillSwitchAction(
        trader_id=trader_id,
        session_id=state["session_id"],
        action_type="override",
        triggered_at=datetime.utcnow(),
        tilt_score_at_trigger=prev_score,
        acknowledged_at=datetime.utcnow(),
        override_reason=req.override_reason,
        metadata_json=json.dumps({"unlocked_score": updated_state["current_score"]})
    )
    db.add(action)
    await db.commit()
    
    # Broadcast to WebSocket
    await state_manager.broadcast_tilt_update(trader_id, {
        "type": "KILL_SWITCH_OVERRIDE",
        "trader_id": trader_id,
        "session_id": state["session_id"],
        "current_score": updated_state["current_score"],
        "status": updated_state["status"],
        "override_reason": req.override_reason,
        "message": f"Kill switch manually overridden: '{req.override_reason}'"
    })
    
    return {
        "status": "success",
        "message": "Kill switch overridden and logged.",
        "current_score": updated_state["current_score"],
        "tilt_status": updated_state["status"]
    }

@router.post("/reset")
async def reset_tilt_score(req: KillSwitchResetRequest, db: AsyncSession = Depends(get_db)):
    trader_id = req.trader_id
    state = state_manager.get_or_create_state(trader_id)
    prev_score = state["current_score"]
    
    updated_state = state_manager.reset_score(trader_id)
    
    # Log reset action
    action = KillSwitchAction(
        trader_id=trader_id,
        session_id=state["session_id"],
        action_type="reset",
        triggered_at=datetime.utcnow(),
        tilt_score_at_trigger=prev_score,
        acknowledged_at=datetime.utcnow(),
        override_reason=req.reason,
        metadata_json=json.dumps({"reset_from": prev_score})
    )
    db.add(action)
    await db.commit()
    
    # Broadcast to WebSocket
    await state_manager.broadcast_tilt_update(trader_id, {
        "type": "TILT_SCORE_RESET",
        "trader_id": trader_id,
        "session_id": state["session_id"],
        "current_score": 0,
        "status": "green",
        "message": f"Tilt score reset to 0. Reason: {req.reason}"
    })
    
    return {
        "status": "success",
        "message": "Tilt score reset to 0.",
        "current_score": 0,
        "tilt_status": "green"
    }

@router.post("/soft-unlock")
async def soft_unlock(req: SoftLockAcknowledgeRequest):
    if req.confirmation_phrase.strip().lower() != "i confirm this trade":
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase must be exactly 'I confirm this trade'"
        )
    
    state = state_manager.get_or_create_state(req.trader_id)
    state["soft_lock_confirmed"] = True
    state["soft_lock_active"] = False
    state["soft_lock_until"] = None
    
    await state_manager.broadcast_tilt_update(req.trader_id, {
        "type": "SOFT_LOCK_CONFIRMED",
        "trader_id": req.trader_id,
        "session_id": state["session_id"],
        "message": "Soft lock confirmed by trader. Ready to execute."
    })
    
    return {
        "status": "success",
        "message": "Trade execution unlocked for next trade."
    }
