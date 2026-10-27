import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Set, Optional, Any, Tuple
from fastapi import WebSocket
from backend.app.config import settings

class StateManager:
    def __init__(self):
        # trader_id -> live state
        self._states: Dict[str, Dict[str, Any]] = {}
        # active websocket connections per trader_id
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    def get_or_create_state(self, trader_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        if trader_id not in self._states:
            now = datetime.utcnow()
            sess_id = session_id or f"sess_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
            self._states[trader_id] = {
                "trader_id": trader_id,
                "session_id": sess_id,
                "current_score": 0,
                "status": "green",
                "last_updated": now,
                "soft_lock_active": False,
                "soft_lock_until": None,
                "soft_lock_confirmed": False,
                "hard_lock_active": False,
                "hard_lock_until": None,
                "peak_score": 0,
                "currency_code": "INR",
                "currency_symbol": "₹",
                "locale": "en-IN",
                "recent_events": []
            }
        elif session_id and self._states[trader_id]["session_id"] != session_id:
            self._states[trader_id]["session_id"] = session_id
        return self._states[trader_id]

    def update_score(
        self,
        trader_id: str,
        new_score: int,
        status: str,
        session_id: Optional[str] = None,
        event: Optional[Dict[str, Any]] = None,
        soft_lock_wait_sec: int = 60,
        hard_lock_cooldown_min: int = 30
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        state = self.get_or_create_state(trader_id, session_id)
        prev_score = state["current_score"]
        prev_status = state["status"]
        
        state["current_score"] = new_score
        state["status"] = status
        state["last_updated"] = now
        state["peak_score"] = max(state.get("peak_score", 0), new_score)

        if event:
            state.setdefault("recent_events", [])
            state["recent_events"].insert(0, event)
            # keep last 50 events in memory
            state["recent_events"] = state["recent_events"][:50]

        # Check soft lock transition (status is orange: 61-90)
        if status == "orange":
            if not state.get("soft_lock_active"):
                state["soft_lock_active"] = True
                state["soft_lock_until"] = now + timedelta(seconds=soft_lock_wait_sec)
                state["soft_lock_confirmed"] = False
        else:
            if status == "green" or status == "yellow":
                state["soft_lock_active"] = False
                state["soft_lock_until"] = None
                state["soft_lock_confirmed"] = False

        # Check hard lock transition (status is red: 91-100 / 90+)
        if status == "red":
            if not state.get("hard_lock_active"):
                state["hard_lock_active"] = True
                state["hard_lock_until"] = now + timedelta(minutes=hard_lock_cooldown_min)
        else:
            if status != "red":
                state["hard_lock_active"] = False
                state["hard_lock_until"] = None

        return state

    def check_trade_allowed(self, trader_id: str, confirmation_text: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Returns:
            allowed: bool
            block_type: None | "soft_lock" | "hard_lock"
            message: reason description
        """
        state = self.get_or_create_state(trader_id)
        now = datetime.utcnow()

        # 1. Hard lock check
        if state.get("hard_lock_active"):
            until = state.get("hard_lock_until")
            if until and now < until:
                rem_mins = max(1, int((until - now).total_seconds() / 60))
                return False, "hard_lock", f"Kill Switch Engaged! Hard lock active for {rem_mins} more minutes. Explicit reason override required."
            elif until and now >= until:
                # Cooldown expired, but still requires score reset or reason
                return False, "hard_lock", "Hard lock cooldown reached minimum 30 min. Enter an override reason or reset score to resume."

        # 2. Soft lock check (Orange: 61-90)
        if state.get("soft_lock_active"):
            until = state.get("soft_lock_until")
            # If trader explicitly confirmed with required phrase
            if confirmation_text and confirmation_text.strip().lower() == "i confirm this trade":
                # Confirmed! Allowed for this trade
                return True, None, "Soft lock bypassed with user confirmation phrase."
            
            # Or if countdown timer finished
            if until and now >= until:
                return True, None, "Mandatory 60s soft lock wait completed."
            
            rem_sec = int((until - now).total_seconds()) if until else 60
            return False, "soft_lock", f"Soft lock active. Please wait {max(1, rem_sec)}s or type 'I confirm this trade' to proceed."

        return True, None, None

    def override_lock(self, trader_id: str, reason: str) -> Dict[str, Any]:
        """Applies manual override to locks and slightly reduces score to 60 (yellow zone)"""
        now = datetime.utcnow()
        state = self.get_or_create_state(trader_id)
        state["hard_lock_active"] = False
        state["hard_lock_until"] = None
        state["soft_lock_active"] = False
        state["soft_lock_until"] = None
        state["soft_lock_confirmed"] = True
        state["current_score"] = min(state["current_score"], 60)
        state["status"] = "yellow" if state["current_score"] > 30 else "green"
        state["last_updated"] = now
        return state

    def reset_score(self, trader_id: str) -> Dict[str, Any]:
        """Resets tilt score back to 0 (green)"""
        now = datetime.utcnow()
        state = self.get_or_create_state(trader_id)
        state["current_score"] = 0
        state["status"] = "green"
        state["soft_lock_active"] = False
        state["soft_lock_until"] = None
        state["soft_lock_confirmed"] = False
        state["hard_lock_active"] = False
        state["hard_lock_until"] = None
        state["last_updated"] = now
        return state

    def reset_session(self, trader_id: str, new_session_id: str) -> Dict[str, Any]:
        now = datetime.utcnow()
        state = self.get_or_create_state(trader_id)
        state["session_id"] = new_session_id
        state["current_score"] = 0
        state["status"] = "green"
        state["soft_lock_active"] = False
        state["soft_lock_until"] = None
        state["soft_lock_confirmed"] = False
        state["hard_lock_active"] = False
        state["hard_lock_until"] = None
        state["peak_score"] = 0
        state["recent_events"] = []
        state["last_updated"] = now
        return state

    # WebSocket connection management
    async def connect_ws(self, trader_id: str, websocket: WebSocket):
        await websocket.accept()
        if trader_id not in self._connections:
            self._connections[trader_id] = set()
        self._connections[trader_id].add(websocket)

    def disconnect_ws(self, trader_id: str, websocket: WebSocket):
        if trader_id in self._connections:
            self._connections[trader_id].discard(websocket)
            if not self._connections[trader_id]:
                del self._connections[trader_id]

    async def broadcast_tilt_update(self, trader_id: str, data: Dict[str, Any]):
        if trader_id in self._connections:
            websockets = list(self._connections[trader_id])
            for ws in websockets:
                try:
                    await ws.send_json(data)
                except Exception:
                    self._connections[trader_id].discard(ws)

state_manager = StateManager()
