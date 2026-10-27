import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db

@pytest.mark.anyio
async def test_complete_revenge_and_lock_lifecycle():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        trader_id = "trader_scenario_test"

        # 1. Start clean session
        start_res = await client.post("/api/session/start", json={
            "trader_id": trader_id,
            "notes": "E2E scenario verification session"
        })
        assert start_res.status_code == 200
        session_id = start_res.json()["session_id"]

        # Set baseline to 24-hour window so outside_hours doesn't interfere
        await client.post(f"/api/baseline/{trader_id}", json={
            "active_session_hours": "00:00-23:59",
            "avg_position_size": 100.0,
            "avg_trades_per_hour": 5.0
        })

        # 2. First trade: loss on NQ (-300) -> +10 points (Score: 10, Green)
        t1 = await client.post("/api/trades", json={
            "trader_id": trader_id,
            "session_id": session_id,
            "instrument": "NQ",
            "trade_type": "long",
            "entry_price": 18200.0,
            "exit_price": 18180.0,
            "position_size": 100.0,
            "pnl": -300.0,
            "timestamp": "2026-10-27T10:00:00",
            "duration_seconds": 60
        })
        assert t1.status_code == 200
        assert t1.json()["current_tilt_score"] == 10
        assert t1.json()["tilt_status"] == "green"

        # 3. Second trade: Immediate re-entry 90s later on NQ (-400)
        # Triggers: LOSS_OCCURRED (+10) + REVENGE_REENTRY (+20) -> 10 + 30 = 40 (Yellow)
        t2 = await client.post("/api/trades", json={
            "trader_id": trader_id,
            "session_id": session_id,
            "instrument": "NQ",
            "trade_type": "long",
            "entry_price": 18180.0,
            "exit_price": 18150.0,
            "position_size": 100.0,
            "pnl": -400.0,
            "timestamp": "2026-10-27T10:01:30",
            "duration_seconds": 60
        })
        assert t2.status_code == 200
        assert t2.json()["current_tilt_score"] == 40
        assert t2.json()["tilt_status"] == "yellow"
        assert t2.json()["action_required"] == "warning"

        # 4. Third trade: Escalated size (250 vs baseline 100) after loss 60s later!
        # Triggers: LOSS_OCCURRED (+10) + REVENGE_REENTRY (+20) + CONSECUTIVE_LOSS (+15) + SIZE_ESCALATION (+20) + SAME_TICKER_FIXATION (+15)
        # Total added = 10 + 20 + 15 + 20 + 15 = 80 points!
        # Current score was 40 + 80 = 120 -> clamped to 100 (Red / Hard Lock)!
        t3 = await client.post("/api/trades", json={
            "trader_id": trader_id,
            "session_id": session_id,
            "instrument": "NQ",
            "trade_type": "long",
            "entry_price": 18150.0,
            "exit_price": 18100.0,
            "position_size": 250.0,
            "pnl": -1250.0,
            "timestamp": "2026-10-27T10:02:30",
            "duration_seconds": 60
        })
        assert t3.status_code == 200
        assert t3.json()["current_tilt_score"] == 100
        assert t3.json()["tilt_status"] == "red"
        assert t3.json()["action_required"] == "hard_lock"

        # 5. Fourth trade attempt: Should be BLOCKED with HTTP 423 (Locked)!
        t4_attempt = await client.post("/api/trades", json={
            "trader_id": trader_id,
            "session_id": session_id,
            "instrument": "NQ",
            "trade_type": "short",
            "entry_price": 18100.0,
            "exit_price": 18050.0,
            "position_size": 100.0,
            "pnl": 500.0,
            "timestamp": "2026-10-27T10:05:00",
            "duration_seconds": 60
        })
        assert t4_attempt.status_code == 423
        detail = t4_attempt.json()["detail"]
        assert detail["block_type"] == "hard_lock"

        # 6. Apply Kill Switch Override with Reason
        override_res = await client.post("/api/kill-switch/override", json={
            "trader_id": trader_id,
            "override_reason": "Macro FOMC announcement confirmed, re-centering sizing to 50 lots."
        })
        assert override_res.status_code == 200
        assert override_res.json()["current_score"] <= 60
        assert override_res.json()["tilt_status"] == "yellow"

        # 7. Fourth trade after override: Allowed!
        t4_retry = await client.post("/api/trades", json={
            "trader_id": trader_id,
            "session_id": session_id,
            "instrument": "NQ",
            "trade_type": "short",
            "entry_price": 18100.0,
            "exit_price": 18050.0,
            "position_size": 50.0,
            "pnl": 500.0,
            "timestamp": "2026-10-27T10:10:00",
            "duration_seconds": 60
        })
        assert t4_retry.status_code == 200

        # 8. End session and verify post-session summary
        summary_res = await client.post("/api/session/end", json={
            "trader_id": trader_id,
            "notes": "Session reviewed"
        })
        assert summary_res.status_code == 200
        summary_data = summary_res.json()
        assert summary_data["total_trades"] == 4
        assert summary_data["peak_tilt_score"] == 100
        assert summary_data["revenge_trades_count"] >= 1
        assert summary_data["estimated_revenge_pnl_loss"] > 0
        assert len(summary_data["suggestions"]) > 0
