import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.database import get_db
from backend.app.models import BrokerConfig
from backend.app.brokers.encryption import encrypt_credential, decrypt_credential, mask_credential
from backend.app.brokers.manager import broker_manager, ADAPTER_MAP
from backend.app.brokers.base import OrderRequest, OrderResponse, Position, Order, AccountInfo
from backend.app.state_manager import state_manager

router = APIRouter(prefix="/api/broker", tags=["broker"])

def get_broker_currency_defaults(broker_name: str) -> dict:
    b = broker_name.lower().strip()
    if b in ["dhan", "zerodha", "fyers", "upstox", "angelone", "breeze"]:
        return {
            "currency_code": "INR",
            "currency_symbol": "₹",
            "locale": "en-IN"
        }
    elif b in ["binance", "bybit", "coinbase", "crypto"]:
        return {
            "currency_code": "USDT",
            "currency_symbol": "USDT",
            "locale": "en-US"
        }
    else:  # US brokers (alpaca, interactive_brokers, tradestation, us_equities)
        return {
            "currency_code": "USD",
            "currency_symbol": "$",
            "locale": "en-US"
        }

class BrokerConnectRequest(BaseModel):
    trader_id: str = "trader_alpha"
    client_id: Optional[str] = None
    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    access_token: Optional[str] = None
    pin: Optional[str] = None
    totp_secret: Optional[str] = None
    is_sandbox: bool = False
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    locale: Optional[str] = None
    auto_cancel_orders_on_lock: bool = True
    auto_square_off_on_lock: bool = False
    sync_interval_seconds: int = 30

class BrokerSettingsUpdate(BaseModel):
    auto_cancel_orders_on_lock: Optional[bool] = None
    auto_square_off_on_lock: Optional[bool] = None
    sync_interval_seconds: Optional[int] = None

class TokenRefreshRequest(BaseModel):
    trader_id: str = "trader_alpha"
    access_token: str
    token_expiry_hours: int = 24

@router.post("/{broker_name}/connect")
async def connect_broker(broker_name: str, req: BrokerConnectRequest, db: AsyncSession = Depends(get_db)):
    broker_key = broker_name.lower().strip()
    if broker_key not in ADAPTER_MAP:
        raise HTTPException(status_code=400, detail=f"Unsupported broker '{broker_name}'. Supported: {list(ADAPTER_MAP.keys())}")

    trader_id = req.trader_id
    now = datetime.utcnow()

    # Deactivate any currently active broker for this trader
    deact_stmt = update(BrokerConfig).where(
        BrokerConfig.trader_id == trader_id
    ).values(is_active=False)
    await db.execute(deact_stmt)

    # Find existing config or create new
    stmt = select(BrokerConfig).where(
        BrokerConfig.trader_id == trader_id,
        BrokerConfig.broker_name == broker_key
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()

    curr_defs = get_broker_currency_defaults(broker_key)
    c_code = req.currency_code or curr_defs["currency_code"]
    c_symbol = req.currency_symbol or curr_defs["currency_symbol"]
    c_locale = req.locale or curr_defs["locale"]

    if not config:
        config = BrokerConfig(
            trader_id=trader_id,
            broker_name=broker_key,
            is_active=True,
            is_sandbox=req.is_sandbox,
            currency_code=c_code,
            currency_symbol=c_symbol,
            locale=c_locale,
            created_at=now
        )
        db.add(config)
    else:
        config.currency_code = c_code
        config.currency_symbol = c_symbol
        config.locale = c_locale

    # Encrypt credentials securely
    if req.client_id:
        config.client_id_encrypted = encrypt_credential(req.client_id)
    if req.api_key:
        config.api_key_encrypted = encrypt_credential(req.api_key)
    if req.secret_key:
        config.secret_key_encrypted = encrypt_credential(req.secret_key)
    if req.access_token:
        config.access_token_encrypted = encrypt_credential(req.access_token)
    if req.pin or req.totp_secret:
        pin_totp = json.dumps({"pin": req.pin, "totp_secret": req.totp_secret})
        config.pin_totp_encrypted = encrypt_credential(pin_totp)

    config.is_active = True
    config.is_sandbox = req.is_sandbox
    config.last_sync_at = now
    config.token_expiry = now + timedelta(hours=24)
    config.set_settings({
        "auto_cancel_orders_on_lock": req.auto_cancel_orders_on_lock,
        "auto_square_off_on_lock": req.auto_square_off_on_lock,
        "sync_interval_seconds": req.sync_interval_seconds
    })

    await db.commit()
    await db.refresh(config)

    # Register in BrokerManager
    adapter_config = {
        "trader_id": trader_id,
        "broker_name": broker_key,
        "client_id": req.client_id,
        "api_key": req.api_key,
        "secret_key": req.secret_key,
        "access_token": req.access_token,
        "pin": req.pin,
        "totp_secret": req.totp_secret,
        "is_sandbox": req.is_sandbox
    }
    adapter = broker_manager.register_adapter(trader_id, broker_key, adapter_config)
    
    # Test connectivity & fetch account info
    account = await adapter.get_account_info()

    # Update in-memory state currency
    state = state_manager.get_or_create_state(trader_id)
    state["currency_code"] = config.currency_code
    state["currency_symbol"] = config.currency_symbol
    state["locale"] = config.locale

    # Broadcast currency & broker config update to connected WebSocket clients
    await state_manager.broadcast_tilt_update(trader_id, {
        "type": "CURRENCY_CONFIG_UPDATED",
        "trader_id": trader_id,
        "broker_name": broker_key,
        "currency_code": config.currency_code,
        "currency_symbol": config.currency_symbol,
        "locale": config.locale
    })

    return {
        "status": "connected",
        "broker_name": broker_key,
        "trader_id": trader_id,
        "is_live": account.is_live,
        "is_sandbox": req.is_sandbox,
        "currency_code": config.currency_code,
        "currency_symbol": config.currency_symbol,
        "locale": config.locale,
        "account_info": account.model_dump()
    }

@router.get("/active-config")
async def get_active_broker_config(trader_id: str = "trader_alpha", db: AsyncSession = Depends(get_db)):
    """
    Returns the currently active broker's configuration, currency symbol,
    currency code, and locale for the trader.
    """
    stmt = select(BrokerConfig).where(
        BrokerConfig.trader_id == trader_id,
        BrokerConfig.is_active == True
    )
    res = await db.execute(stmt)
    config = res.scalars().first()

    if not config:
        # Fallback to any saved config or default Dhan (₹ INR)
        stmt_any = select(BrokerConfig).where(BrokerConfig.trader_id == trader_id).order_by(BrokerConfig.id.desc())
        res_any = await db.execute(stmt_any)
        config = res_any.scalars().first()

    if not config:
        defaults = get_broker_currency_defaults("dhan")
        return {
            "trader_id": trader_id,
            "broker_name": "dhan",
            "is_active": False,
            "is_sandbox": True,
            "currency_code": defaults["currency_code"],
            "currency_symbol": defaults["currency_symbol"],
            "locale": defaults["locale"],
            "settings": {"auto_cancel_orders_on_lock": True, "auto_square_off_on_lock": False, "sync_interval_seconds": 30},
            "last_sync_at": None
        }

    c_dict = config.to_dict()
    c_dict["client_id_masked"] = mask_credential(decrypt_credential(config.client_id_encrypted))
    c_dict["api_key_masked"] = mask_credential(decrypt_credential(config.api_key_encrypted))
    return c_dict

@router.post("/{broker_name}/disconnect")
async def disconnect_broker(broker_name: str, trader_id: str = "trader_alpha", db: AsyncSession = Depends(get_db)):
    broker_key = broker_name.lower().strip()
    stmt = select(BrokerConfig).where(
        BrokerConfig.trader_id == trader_id,
        BrokerConfig.broker_name == broker_key
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()
    if config:
        config.is_active = False
        await db.commit()

    broker_manager.unregister_adapter(trader_id)
    return {"status": "disconnected", "broker_name": broker_key, "trader_id": trader_id}

@router.get("/configs/{trader_id}")
async def get_broker_configs(trader_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(BrokerConfig).where(BrokerConfig.trader_id == trader_id)
    res = await db.execute(stmt)
    configs = res.scalars().all()

    result = []
    for c in configs:
        c_dict = c.to_dict()
        c_dict["client_id_masked"] = mask_credential(decrypt_credential(c.client_id_encrypted))
        c_dict["api_key_masked"] = mask_credential(decrypt_credential(c.api_key_encrypted))
        result.append(c_dict)
    return result

@router.post("/configs/{trader_id}/settings")
async def update_broker_settings(trader_id: str, req: BrokerSettingsUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(BrokerConfig).where(BrokerConfig.trader_id == trader_id, BrokerConfig.is_active == True)
    res = await db.execute(stmt)
    configs = res.scalars().all()

    for c in configs:
        settings = c.get_settings()
        if req.auto_cancel_orders_on_lock is not None:
            settings["auto_cancel_orders_on_lock"] = req.auto_cancel_orders_on_lock
        if req.auto_square_off_on_lock is not None:
            settings["auto_square_off_on_lock"] = req.auto_square_off_on_lock
        if req.sync_interval_seconds is not None:
            settings["sync_interval_seconds"] = req.sync_interval_seconds
        c.set_settings(settings)

    await db.commit()
    return {"status": "success", "message": "Broker settings updated"}

@router.post("/sync/{trader_id}")
async def sync_broker_now(trader_id: str, db: AsyncSession = Depends(get_db)):
    """Triggers immediate trade sync and updates last_sync_at"""
    synced_count = await broker_manager.sync_trades_from_broker(trader_id, db)
    
    # Update last_sync_at
    stmt = update(BrokerConfig).where(
        BrokerConfig.trader_id == trader_id,
        BrokerConfig.is_active == True
    ).values(last_sync_at=datetime.utcnow())
    await db.execute(stmt)
    await db.commit()

    adapter = broker_manager.get_adapter(trader_id)
    positions = await adapter.get_positions() if adapter else []
    orders = await adapter.get_order_history() if adapter else []

    return {
        "status": "success",
        "synced_trades": synced_count,
        "positions_count": len(positions),
        "orders_count": len(orders),
        "last_sync_at": datetime.utcnow().isoformat()
    }

@router.get("/positions/{trader_id}")
async def get_broker_positions(trader_id: str):
    adapter = broker_manager.get_adapter(trader_id)
    if not adapter:
        adapter = broker_manager.register_adapter(trader_id, "dhan", {"trader_id": trader_id, "is_sandbox": True})
    positions = await adapter.get_positions()
    return [p.model_dump() for p in positions]

@router.get("/orders/{trader_id}")
async def get_broker_orders(trader_id: str):
    adapter = broker_manager.get_adapter(trader_id)
    if not adapter:
        adapter = broker_manager.register_adapter(trader_id, "dhan", {"trader_id": trader_id, "is_sandbox": True})
    orders = await adapter.get_order_history()
    return [o.model_dump() for o in orders]

@router.post("/orders/{trader_id}", response_model=OrderResponse)
async def place_broker_order(
    trader_id: str, 
    order: OrderRequest, 
    soft_lock_confirmation: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Places an order on the active broker, routed through the Kill Switch Intelligence Layer.
    Blocks order if Hard Lock is active or if Soft Lock confirmation is missing.
    """
    res = await broker_manager.place_order_intercepted(
        trader_id=trader_id,
        order=order,
        db=db,
        soft_lock_confirmation=soft_lock_confirmation
    )
    if res.is_blocked_by_kill_switch:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "block_type": "kill_switch_blocked",
                "message": res.message,
                "order_id": res.order_id
            }
        )
    return res

@router.delete("/orders/{trader_id}/{order_id}")
async def cancel_broker_order(trader_id: str, order_id: str):
    adapter = broker_manager.get_adapter(trader_id)
    if not adapter:
        raise HTTPException(status_code=404, detail="No active broker connected")
    success = await adapter.cancel_order(order_id)
    return {"status": "success" if success else "failed", "order_id": order_id}

@router.post("/{broker_name}/refresh-token")
async def refresh_broker_token(broker_name: str, req: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    broker_key = broker_name.lower().strip()
    stmt = select(BrokerConfig).where(
        BrokerConfig.trader_id == req.trader_id,
        BrokerConfig.broker_name == broker_key
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"No config found for broker '{broker_name}'")

    config.access_token_encrypted = encrypt_credential(req.access_token)
    config.token_expiry = datetime.utcnow() + timedelta(hours=req.token_expiry_hours)
    await db.commit()
    return {"status": "token_refreshed", "broker_name": broker_key, "token_expiry": config.token_expiry.isoformat()}
