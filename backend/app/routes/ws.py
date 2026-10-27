import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.state_manager import state_manager

router = APIRouter(tags=["websocket"])

@router.websocket("/ws/tilt/{trader_id}")
async def websocket_tilt_endpoint(websocket: WebSocket, trader_id: str):
    await state_manager.connect_ws(trader_id, websocket)
    try:
        # Send initial state snapshot on connection
        state = state_manager.get_or_create_state(trader_id)
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "trader_id": trader_id,
            "session_id": state["session_id"],
            "current_score": state["current_score"],
            "status": state["status"],
            "soft_lock_active": state.get("soft_lock_active", False),
            "hard_lock_active": state.get("hard_lock_active", False),
            "currency_code": state.get("currency_code", "INR"),
            "currency_symbol": state.get("currency_symbol", "₹"),
            "locale": state.get("locale", "en-IN"),
            "recent_events": state.get("recent_events", [])
        })

        # Keep connection open and receive any client ping
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_json({"type": "PONG"})
            except Exception:
                pass
    except WebSocketDisconnect:
        state_manager.disconnect_ws(trader_id, websocket)
    except Exception:
        state_manager.disconnect_ws(trader_id, websocket)
