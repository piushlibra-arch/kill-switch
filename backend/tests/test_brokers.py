import pytest
import pyotp
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db
from backend.app.brokers.base import BrokerAdapter, OrderRequest
from backend.app.brokers.dhan import DhanAdapter
from backend.app.brokers.upstox import UpstoxAdapter
from backend.app.brokers.zerodha import ZerodhaAdapter
from backend.app.brokers.fyers import FyersAdapter
from backend.app.brokers.angel_one import AngelOneAdapter
from backend.app.brokers.breeze import BreezeAdapter
from backend.app.brokers.encryption import encrypt_credential, decrypt_credential, mask_credential
from backend.app.brokers.manager import broker_manager
from backend.app.state_manager import state_manager

def test_encryption_helpers():
    secret = "dhan_live_jwt_token_xyz123"
    enc = encrypt_credential(secret)
    assert enc != secret
    assert decrypt_credential(enc) == secret
    assert mask_credential(secret) == "dhan••••••••z123"

@pytest.mark.anyio
async def test_all_six_broker_adapters():
    adapters = [
        ("dhan", DhanAdapter({"trader_id": "t1", "client_id": "1001", "access_token": "tok1", "is_sandbox": True})),
        ("upstox", UpstoxAdapter({"trader_id": "t1", "access_token": "tok2", "is_sandbox": True})),
        ("zerodha", ZerodhaAdapter({"trader_id": "t1", "api_key": "k3", "access_token": "tok3", "is_sandbox": True})),
        ("fyers", FyersAdapter({"trader_id": "t1", "client_id": "f4", "access_token": "tok4"})),
        ("angelone", AngelOneAdapter({"trader_id": "t1", "api_key": "a5", "client_id": "ang1", "totp_secret": pyotp.random_base32()})),
        ("breeze", BreezeAdapter({"trader_id": "t1", "api_key": "b6", "access_token": "tok6"}))
    ]

    for name, adapter in adapters:
        assert isinstance(adapter, BrokerAdapter)
        
        # 1. Account info
        acc = await adapter.get_account_info()
        assert acc.broker_name == name
        assert acc.available_cash > 0

        # 2. Positions
        positions = await adapter.get_positions()
        assert isinstance(positions, list)
        if positions:
            assert positions[0].symbol != ""

        # 3. Order placement
        order_req = OrderRequest(
            symbol="NIFTY",
            transaction_type="BUY",
            order_type="MARKET",
            quantity=50.0,
            price=100.0,
            tag="test-order"
        )
        res = await adapter.place_order(order_req)
        assert res.status in ["SUBMITTED", "COMPLETE"]
        assert not res.is_blocked_by_kill_switch

        # 4. Cancel order
        cancelled = await adapter.cancel_order(res.order_id)
        assert cancelled is True

        # 5. Block trading (Kill switch)
        blocked = await adapter.block_trading()
        assert blocked is True
        assert adapter.is_trading_blocked is True

        # 6. Subsequent order blocked
        blocked_res = await adapter.place_order(order_req)
        assert blocked_res.is_blocked_by_kill_switch is True
        assert blocked_res.status == "BLOCKED_KILL_SWITCH"

def test_angel_one_totp_generation():
    secret = pyotp.random_base32()
    adapter = AngelOneAdapter({
        "trader_id": "t1",
        "api_key": "key",
        "client_id": "ANGEL123",
        "totp_secret": secret
    })
    otp = adapter.generate_totp()
    assert otp is not None
    assert len(otp) == 6
    assert otp.isdigit()

@pytest.mark.anyio
async def test_broker_api_flow():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        trader_id = "trader_broker_api_test"

        # 1. Connect Dhan broker
        conn_res = await client.post("/api/broker/dhan/connect", json={
            "trader_id": trader_id,
            "client_id": "1002348",
            "access_token": "dhan_jwt_test_token_2026",
            "is_sandbox": True,
            "auto_cancel_orders_on_lock": True
        })
        assert conn_res.status_code == 200
        conn_data = conn_res.json()
        assert conn_data["status"] == "connected"
        assert conn_data["broker_name"] == "dhan"

        # 2. Get positions
        pos_res = await client.get(f"/api/broker/positions/{trader_id}")
        assert pos_res.status_code == 200
        assert len(pos_res.json()) >= 1

        # 3. Place order via broker API (allowed in Green state)
        order_res = await client.post(f"/api/broker/orders/{trader_id}", json={
            "symbol": "NIFTY26OCT24500CE",
            "transaction_type": "BUY",
            "order_type": "MARKET",
            "quantity": 50.0,
            "price": 125.0
        })
        assert order_res.status_code == 200
        assert order_res.json()["status"] == "SUBMITTED"

        # 4. Trigger Kill Switch Hard Lock on this trader
        state_manager.update_score(trader_id, new_score=95, status="red")

        # 5. Attempt placing order while Hard Lock active -> BLOCKED!
        blocked_attempt = await client.post(f"/api/broker/orders/{trader_id}", json={
            "symbol": "BANKNIFTY26OCT52000PE",
            "transaction_type": "BUY",
            "order_type": "MARKET",
            "quantity": 30.0,
            "price": 220.0
        })
        assert blocked_attempt.status_code == 423
        assert "Kill Switch" in str(blocked_attempt.json())

        # 6. Test Sync Endpoint
        sync_res = await client.post(f"/api/broker/sync/{trader_id}")
        assert sync_res.status_code == 200
        assert "last_sync_at" in sync_res.json()

        # 7. Check configs listing
        cfg_res = await client.get(f"/api/broker/configs/{trader_id}")
        assert cfg_res.status_code == 200
        cfgs = cfg_res.json()
        assert len(cfgs) >= 1
        assert cfgs[0]["broker_name"] == "dhan"
        assert "client_id_masked" in cfgs[0]
