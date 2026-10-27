import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db

@pytest.mark.anyio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

@pytest.mark.anyio
async def test_baseline_and_trade_flow():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Baseline
        b_res = await client.get("/api/baseline/trader_test_api")
        assert b_res.status_code == 200
        b_data = b_res.json()
        assert b_data["trader_id"] == "trader_test_api"
        assert b_data["avg_position_size"] == 100.0

        # 2. Submit a winning trade during active session hours (10:30)
        trade1 = {
            "trader_id": "trader_test_api",
            "instrument": "NQ",
            "trade_type": "long",
            "entry_price": 18000.0,
            "exit_price": 18050.0,
            "position_size": 100.0,
            "pnl": 500.0,
            "timestamp": "2026-10-27T10:30:00",
            "duration_seconds": 120
        }
        t1_res = await client.post("/api/trades", json=trade1)
        assert t1_res.status_code == 200
        t1_data = t1_res.json()
        assert t1_data["current_tilt_score"] == 0
        assert t1_data["tilt_status"] == "green"

        # 3. Submit a loss during active session hours
        trade2 = {
            "trader_id": "trader_test_api",
            "instrument": "NQ",
            "trade_type": "short",
            "entry_price": 18050.0,
            "exit_price": 18080.0,
            "position_size": 100.0,
            "pnl": -300.0,
            "timestamp": "2026-10-27T10:40:00",
            "duration_seconds": 60
        }
        t2_res = await client.post("/api/trades", json=trade2)
        assert t2_res.status_code == 200
        t2_data = t2_res.json()
        assert t2_data["current_tilt_score"] == 10
        assert len(t2_data["triggered_events"]) > 0

        # 4. Check Tilt Score endpoint
        score_res = await client.get("/api/tilt-score/trader_test_api")
        assert score_res.status_code == 200
        score_data = score_res.json()
        assert score_data["current_score"] == 10
        assert score_data["status"] == "green"

        # 5. Check Tilt Events endpoint
        events_res = await client.get("/api/tilt-events/trader_test_api")
        assert events_res.status_code == 200
        assert len(events_res.json()) >= 1

        # 6. Test Reset endpoint
        reset_res = await client.post("/api/kill-switch/reset", json={
            "trader_id": "trader_test_api",
            "reason": "Test manual reset"
        })
        assert reset_res.status_code == 200
        assert reset_res.json()["current_score"] == 0

        # 7. Check Analytics endpoint
        analytics_res = await client.get("/api/analytics/trader_test_api")
        assert analytics_res.status_code == 200
        ana_data = analytics_res.json()
        assert "rule_breakdown" in ana_data
        assert "pattern_heatmap" in ana_data
