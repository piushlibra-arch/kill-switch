import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import TraderBaseline, Trade
from backend.app.schemas import BaselineResponse, BaselineUpdate

router = APIRouter(prefix="/api/baseline", tags=["baseline"])

async def get_or_create_baseline(trader_id: str, db: AsyncSession) -> TraderBaseline:
    stmt = select(TraderBaseline).where(TraderBaseline.trader_id == trader_id)
    result = await db.execute(stmt)
    baseline = result.scalar_one_or_none()
    
    if not baseline:
        baseline = TraderBaseline(
            trader_id=trader_id,
            avg_position_size=100.0,
            avg_trades_per_hour=3.0,
            preferred_instruments_json=json.dumps(["NQ", "ES", "AAPL", "NVDA", "TSLA"]),
            active_session_hours="09:30-16:00",
            avg_win_rate=0.55,
            avg_loss_rate=0.45,
            hard_lock_cooldown_minutes=30,
            soft_lock_cooldown_seconds=60,
            last_calculated=datetime.utcnow()
        )
        db.add(baseline)
        await db.commit()
        await db.refresh(baseline)
    return baseline

@router.get("/{trader_id}", response_model=BaselineResponse)
async def get_baseline(trader_id: str, db: AsyncSession = Depends(get_db)):
    baseline = await get_or_create_baseline(trader_id, db)
    return BaselineResponse(
        trader_id=baseline.trader_id,
        avg_position_size=baseline.avg_position_size,
        avg_trades_per_hour=baseline.avg_trades_per_hour,
        preferred_instruments=baseline.get_preferred_instruments(),
        active_session_hours=baseline.active_session_hours,
        avg_win_rate=baseline.avg_win_rate,
        avg_loss_rate=baseline.avg_loss_rate,
        hard_lock_cooldown_minutes=baseline.hard_lock_cooldown_minutes,
        soft_lock_cooldown_seconds=baseline.soft_lock_cooldown_seconds,
        last_calculated=baseline.last_calculated
    )

@router.post("/{trader_id}", response_model=BaselineResponse)
async def update_baseline(trader_id: str, update_data: BaselineUpdate, db: AsyncSession = Depends(get_db)):
    baseline = await get_or_create_baseline(trader_id, db)
    
    if update_data.avg_position_size is not None:
        baseline.avg_position_size = update_data.avg_position_size
    if update_data.avg_trades_per_hour is not None:
        baseline.avg_trades_per_hour = update_data.avg_trades_per_hour
    if update_data.preferred_instruments is not None:
        baseline.set_preferred_instruments(update_data.preferred_instruments)
    if update_data.active_session_hours is not None:
        baseline.active_session_hours = update_data.active_session_hours
    if update_data.hard_lock_cooldown_minutes is not None:
        baseline.hard_lock_cooldown_minutes = update_data.hard_lock_cooldown_minutes
    if update_data.soft_lock_cooldown_seconds is not None:
        baseline.soft_lock_cooldown_seconds = update_data.soft_lock_cooldown_seconds
        
    baseline.last_calculated = datetime.utcnow()
    await db.commit()
    await db.refresh(baseline)
    
    return BaselineResponse(
        trader_id=baseline.trader_id,
        avg_position_size=baseline.avg_position_size,
        avg_trades_per_hour=baseline.avg_trades_per_hour,
        preferred_instruments=baseline.get_preferred_instruments(),
        active_session_hours=baseline.active_session_hours,
        avg_win_rate=baseline.avg_win_rate,
        avg_loss_rate=baseline.avg_loss_rate,
        hard_lock_cooldown_minutes=baseline.hard_lock_cooldown_minutes,
        soft_lock_cooldown_seconds=baseline.soft_lock_cooldown_seconds,
        last_calculated=baseline.last_calculated
    )

@router.post("/{trader_id}/recalculate", response_model=BaselineResponse)
async def recalculate_baseline(trader_id: str, db: AsyncSession = Depends(get_db)):
    """Recalculates baseline statistics from historical trades (simulates daily task)"""
    baseline = await get_or_create_baseline(trader_id, db)
    
    stmt = select(Trade).where(Trade.trader_id == trader_id).order_by(Trade.timestamp.desc()).limit(100)
    result = await db.execute(stmt)
    trades = result.scalars().all()
    
    if trades:
        total = len(trades)
        wins = len([t for t in trades if t.pnl > 0])
        baseline.avg_win_rate = round(wins / total, 2)
        baseline.avg_loss_rate = round((total - wins) / total, 2)
        baseline.avg_position_size = round(sum(t.position_size for t in trades) / total, 1)
        
        # Calculate hourly trades from session spread
        if total >= 2:
            span_hours = max(1.0, (trades[0].timestamp - trades[-1].timestamp).total_seconds() / 3600)
            baseline.avg_trades_per_hour = round(max(1.0, total / span_hours), 1)
        
        # Preferred instruments
        inst_counts = {}
        for t in trades:
            inst_counts[t.instrument] = inst_counts.get(t.instrument, 0) + 1
        sorted_insts = sorted(inst_counts.keys(), key=lambda k: inst_counts[k], reverse=True)[:5]
        if sorted_insts:
            baseline.set_preferred_instruments(sorted_insts)
            
    baseline.last_calculated = datetime.utcnow()
    await db.commit()
    await db.refresh(baseline)
    
    return BaselineResponse(
        trader_id=baseline.trader_id,
        avg_position_size=baseline.avg_position_size,
        avg_trades_per_hour=baseline.avg_trades_per_hour,
        preferred_instruments=baseline.get_preferred_instruments(),
        active_session_hours=baseline.active_session_hours,
        avg_win_rate=baseline.avg_win_rate,
        avg_loss_rate=baseline.avg_loss_rate,
        hard_lock_cooldown_minutes=baseline.hard_lock_cooldown_minutes,
        soft_lock_cooldown_seconds=baseline.soft_lock_cooldown_seconds,
        last_calculated=baseline.last_calculated
    )
