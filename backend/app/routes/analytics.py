from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import Trade, TiltEvent
from backend.app.schemas import AnalyticsResponse, RuleTriggerStat, HeatmapHourStat, TimelinePoint
from backend.app.rules_engine import RULE_DEFINITIONS
from backend.app.state_manager import state_manager

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/{trader_id}", response_model=AnalyticsResponse)
async def get_analytics(trader_id: str, db: AsyncSession = Depends(get_db)):
    state = state_manager.get_or_create_state(trader_id)
    session_id = state.get("session_id")

    # Fetch trades for this session
    trades_stmt = select(Trade).where(
        Trade.trader_id == trader_id,
        Trade.session_id == session_id
    ).order_by(Trade.timestamp.asc())
    trades_res = await db.execute(trades_stmt)
    trades = trades_res.scalars().all()

    # If no trades in this session yet, fetch recent trades across trader history
    if not trades:
        trades_all_stmt = select(Trade).where(
            Trade.trader_id == trader_id
        ).order_by(Trade.timestamp.asc()).limit(50)
        trades_all_res = await db.execute(trades_all_stmt)
        trades = trades_all_res.scalars().all()

    # Fetch events
    events_stmt = select(TiltEvent).where(
        TiltEvent.trader_id == trader_id
    ).order_by(TiltEvent.timestamp.asc()).limit(200)
    events_res = await db.execute(events_stmt)
    events = events_res.scalars().all()

    total_trades = len(trades)
    winning_trades = len([t for t in trades if t.pnl > 0])
    win_rate = round(winning_trades / total_trades, 2) if total_trades > 0 else 0.0
    total_pnl = round(sum(t.pnl for t in trades), 2)
    current_score = state.get("current_score", 0)
    peak_score = state.get("peak_score", current_score)

    # 1. Rule breakdown
    rule_counts: Dict[str, Dict[str, Any]] = {}
    for r_key, r_def in RULE_DEFINITIONS.items():
        rule_counts[r_key] = {
            "rule_name": r_key,
            "display_name": r_def["display_name"],
            "count": 0,
            "total_points": 0,
            "color": r_def["color"]
        }

    for ev in events:
        if ev.event_type in rule_counts:
            rule_counts[ev.event_type]["count"] += 1
            rule_counts[ev.event_type]["total_points"] += ev.points_added

    rule_breakdown = [
        RuleTriggerStat(**v) for v in rule_counts.values()
    ]
    # Sort by count desc
    rule_breakdown.sort(key=lambda x: x.count, reverse=True)

    # 2. Revenge trades detection history
    revenge_trades = []
    revenge_events = [e for e in events if e.event_type == "REVENGE_REENTRY"]
    for rev_ev in revenge_events:
        meta = rev_ev.get_metadata()
        matched_trade = next((t for t in trades if t.id == rev_ev.trade_id), None)
        revenge_trades.append({
            "event_id": rev_ev.id,
            "timestamp": rev_ev.timestamp.isoformat() if rev_ev.timestamp else None,
            "instrument": meta.get("instrument", matched_trade.instrument if matched_trade else "N/A"),
            "seconds_since_loss": meta.get("seconds_since_loss", 60),
            "trade_pnl": matched_trade.pnl if matched_trade else 0.0,
            "position_size": matched_trade.position_size if matched_trade else 0.0,
            "loss_avoided": False
        })

    # 3. Timeline points
    # Reconstruct timeline score step by step
    timeline: List[TimelinePoint] = []
    running_score = 0
    trade_map = {t.id: t for t in trades}
    
    for ev in events:
        running_score = min(100, max(0, running_score + ev.points_added))
        t = trade_map.get(ev.trade_id)
        timeline.append(TimelinePoint(
            timestamp=ev.timestamp,
            score=running_score,
            trade_id=ev.trade_id,
            pnl=t.pnl if t else None,
            event_type=ev.event_type
        ))
    
    if not timeline and trades:
        for t in trades:
            timeline.append(TimelinePoint(
                timestamp=t.timestamp,
                score=0,
                trade_id=t.id,
                pnl=t.pnl,
                event_type="TRADE"
            ))

    # 4. Pattern Heatmap: 24 hours of day
    hour_stats: Dict[int, Dict[str, Any]] = {}
    for h in range(24):
        hour_stats[h] = {
            "hour": h,
            "label": f"{h:02d}:00",
            "trade_count": 0,
            "tilt_points": 0,
            "avg_score": 0.0
        }

    for t in trades:
        if t.timestamp:
            h = t.timestamp.hour
            hour_stats[h]["trade_count"] += 1

    for ev in events:
        if ev.timestamp:
            h = ev.timestamp.hour
            hour_stats[h]["tilt_points"] += ev.points_added

    for h, stat in hour_stats.items():
        if stat["trade_count"] > 0:
            stat["avg_score"] = round(stat["tilt_points"] / stat["trade_count"], 1)

    pattern_heatmap = [HeatmapHourStat(**v) for v in hour_stats.values()]

    return AnalyticsResponse(
        session_id=session_id or "default",
        trader_id=trader_id,
        total_trades=total_trades,
        win_rate=win_rate,
        total_pnl=total_pnl,
        current_score=current_score,
        peak_score=peak_score,
        rule_breakdown=rule_breakdown,
        revenge_trades_history=revenge_trades,
        timeline=timeline,
        pattern_heatmap=pattern_heatmap
    )
