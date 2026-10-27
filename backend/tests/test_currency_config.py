import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db
from backend.app.routes.broker import get_broker_currency_defaults

def test_currency_defaults_mapping():
    # Indian Brokers -> ₹ / INR / en-IN
    for b in ["dhan", "zerodha", "fyers", "upstox", "angelone", "breeze"]:
        defs = get_broker_currency_defaults(b)
        assert defs["currency_symbol"] == "₹"
        assert defs["currency_code"] == "INR"
        assert defs["locale"] == "en-IN"

    # US Brokers -> $ / USD / en-US
    for b in ["alpaca", "interactive_brokers", "tradestation", "us_equities"]:
        defs = get_broker_currency_defaults(b)
        assert defs["currency_symbol"] == "$"
        assert defs["currency_code"] == "USD"
        assert defs["locale"] == "en-US"

    # Crypto Brokers -> USDT / en-US
    for b in ["binance", "bybit", "coinbase", "crypto"]:
        defs = get_broker_currency_defaults(b)
        assert defs["currency_symbol"] == "USDT"
        assert defs["currency_code"] == "USDT"

@pytest.mark.anyio
async def test_active_broker_config_endpoint_and_switching():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        trader_id = "trader_currency_tester"

        # 1. Connect Indian broker (Dhan)
        res_dhan = await client.post("/api/broker/dhan/connect", json={
            "trader_id": trader_id,
            "client_id": "DHAN_123",
            "access_token": "token_dhan",
            "is_sandbox": True
        })
        assert res_dhan.status_code == 200
        dhan_data = res_dhan.json()
        assert dhan_data["currency_symbol"] == "₹"
        assert dhan_data["currency_code"] == "INR"
        assert dhan_data["locale"] == "en-IN"

        # 2. Verify /api/broker/active-config returns Dhan config
        active_res = await client.get(f"/api/broker/active-config?trader_id={trader_id}")
        assert active_res.status_code == 200
        active_data = active_res.json()
        assert active_data["broker_name"] == "dhan"
        assert active_data["currency_symbol"] == "₹"
        assert active_data["currency_code"] == "INR"
        assert active_data["locale"] == "en-IN"

        # 3. Switch to US Broker (Alpaca)
        res_us = await client.post("/api/broker/alpaca/connect", json={
            "trader_id": trader_id,
            "api_key": "alpaca_key",
            "secret_key": "alpaca_sec",
            "is_sandbox": True
        })
        assert res_us.status_code == 200
        us_data = res_us.json()
        assert us_data["currency_symbol"] == "$"
        assert us_data["currency_code"] == "USD"
        assert us_data["locale"] == "en-US"

        # 4. Verify /api/broker/active-config dynamically switched to $ USD
        active_us_res = await client.get(f"/api/broker/active-config?trader_id={trader_id}")
        assert active_us_res.status_code == 200
        active_us_data = active_us_res.json()
        assert active_us_data["broker_name"] == "alpaca"
        assert active_us_data["currency_symbol"] == "$"
        assert active_us_data["currency_code"] == "USD"
        assert active_us_data["locale"] == "en-US"

        # 5. Switch to Crypto Broker (Binance)
        res_crypto = await client.post("/api/broker/binance/connect", json={
            "trader_id": trader_id,
            "api_key": "binance_key",
            "secret_key": "binance_sec",
            "is_sandbox": True
        })
        assert res_crypto.status_code == 200
        crypto_data = res_crypto.json()
        assert crypto_data["currency_symbol"] == "USDT"
        assert crypto_data["currency_code"] == "USDT"

        # 6. Verify /api/broker/active-config dynamically switched to USDT
        active_crypto_res = await client.get(f"/api/broker/active-config?trader_id={trader_id}")
        assert active_crypto_res.status_code == 200
        active_crypto_data = active_crypto_res.json()
        assert active_crypto_data["broker_name"] == "binance"
        assert active_crypto_data["currency_symbol"] == "USDT"
        assert active_crypto_data["currency_code"] == "USDT"
