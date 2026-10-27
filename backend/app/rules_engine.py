from datetime import datetime, time, timedelta
from typing import List, Tuple, Dict, Any, Optional
from backend.app.models import Trade, TraderBaseline, TiltEvent

RULE_DEFINITIONS = {
    "LOSS_OCCURRED": {
        "display_name": "Loss Incurred",
        "points": 10,
        "description": "Trade resulted in negative PnL",
        "color": "#EF4444"
    },
    "REVENGE_REENTRY": {
        "display_name": "Revenge Re-entry",
        "points": 20,
        "description": "Entered same instrument < 3 min after a loss",
        "color": "#F97316"
    },
    "CONSECUTIVE_LOSS": {
        "display_name": "Consecutive Loss Streak",
        "points": 15,
        "description": "3 or more losses in a row (per loss)",
        "color": "#DC2626"
    },
    "SIZE_ESCALATION": {
        "display_name": "Size Escalation",
        "points": 20,
        "description": "Position size > 1.5x baseline immediately after loss",
        "color": "#EA580C"
    },
    "SAME_TICKER_FIXATION": {
        "display_name": "Ticker Fixation",
        "points": 15,
        "description": "3+ trades on the same instrument within 30 min",
        "color": "#D97706"
    },
    "OUTSIDE_SESSION": {
        "display_name": "Outside Active Hours",
        "points": 25,
        "description": "Trade executed outside defined active session hours",
        "color": "#9333EA"
    },
    "FREQUENCY_SPIKE": {
        "display_name": "Frequency Spike",
        "points": 15,
        "description": "Trading rate > 2x hourly baseline",
        "color": "#E11D48"
    },
    "FOMO_CHASE": {
        "display_name": "FOMO Chase Entry",
        "points": 10,
        "description": "Entered move already 70%+ extended against ATR",
        "color": "#F59E0B"
    },
    "OVERCONFIDENCE": {
        "display_name": "Overconfidence Sizing",
        "points": 10,
        "description": "Position size 2x+ baseline after 3 consecutive wins",
        "color": "#3B82F6"
    },
    "BOREDOM_TRADE": {
        "display_name": "Boredom / Low Setup",
        "points": 10,
        "description": "Low volatility environment without defined setup",
        "color": "#64748B"
    }
}

class RulesEngine:
    def __init__(self, baseline: TraderBaseline):
        self.baseline = baseline

    def evaluate_trade(
        self,
        current_trade: Trade,
        prior_trades: List[Trade],
        current_score: int,
        last_event_time: Optional[datetime] = None
    ) -> Tuple[List[Dict[str, Any]], int, str]:
        """
        Evaluates all 10 tilt rules against the incoming trade and trade history.
        Returns:
            triggered_events: list of dicts with rule details
            new_score: updated clamped tilt score (0-100)
            status: green / yellow / orange / red
        """
        trade_time = current_trade.timestamp or datetime.utcnow()
        triggered: List[Dict[str, Any]] = []

        # Sort prior trades chronologically
        history = sorted(
            [t for t in prior_trades if t.timestamp and t.timestamp <= trade_time],
            key=lambda t: t.timestamp
        )

        # Check Auto-reset cooldown: if 4 hours cooldown since last event and score < 30
        effective_score = current_score
        if last_event_time and effective_score < 30:
            cooldown_seconds = (trade_time - last_event_time).total_seconds()
            if cooldown_seconds >= 4 * 3600:
                effective_score = 0

        # -------------------------------------------------------------
        # Rule 1: LOSS_OCCURRED (trade.pnl < 0) -> +10
        # -------------------------------------------------------------
        if current_trade.pnl < 0:
            triggered.append({
                "event_type": "LOSS_OCCURRED",
                "points_added": RULE_DEFINITIONS["LOSS_OCCURRED"]["points"],
                "metadata": {
                    "pnl": current_trade.pnl,
                    "instrument": current_trade.instrument
                }
            })

        # -------------------------------------------------------------
        # Rule 2: REVENGE_REENTRY (loss + new trade < 3 min, same instrument) -> +20
        # -------------------------------------------------------------
        # Find previous trade for this specific instrument
        same_inst_trades = [t for t in history if t.instrument == current_trade.instrument]
        if same_inst_trades:
            last_same = same_inst_trades[-1]
            if last_same.pnl < 0 and last_same.timestamp:
                delta_sec = (trade_time - last_same.timestamp).total_seconds()
                if 0 <= delta_sec <= 180:  # 3 minutes
                    triggered.append({
                        "event_type": "REVENGE_REENTRY",
                        "points_added": RULE_DEFINITIONS["REVENGE_REENTRY"]["points"],
                        "metadata": {
                            "instrument": current_trade.instrument,
                            "seconds_since_loss": int(delta_sec),
                            "prior_loss_pnl": last_same.pnl,
                            "prior_trade_id": last_same.id
                        }
                    })

        # -------------------------------------------------------------
        # Rule 3: CONSECUTIVE_LOSS (3+ losses in a row) -> +15 per loss
        # -------------------------------------------------------------
        if current_trade.pnl < 0:
            consecutive_losses = 1
            for prev in reversed(history):
                if prev.pnl < 0:
                    consecutive_losses += 1
                else:
                    break
            if consecutive_losses >= 3:
                triggered.append({
                    "event_type": "CONSECUTIVE_LOSS",
                    "points_added": RULE_DEFINITIONS["CONSECUTIVE_LOSS"]["points"],
                    "metadata": {
                        "consecutive_loss_streak": consecutive_losses,
                        "pnl": current_trade.pnl
                    }
                })

        # -------------------------------------------------------------
        # Rule 4: SIZE_ESCALATION (position_size > 1.5x trader baseline after loss) -> +20
        # -------------------------------------------------------------
        if history:
            prev_trade = history[-1]
            if prev_trade.pnl < 0:
                threshold = 1.5 * self.baseline.avg_position_size
                if current_trade.position_size > threshold:
                    triggered.append({
                        "event_type": "SIZE_ESCALATION",
                        "points_added": RULE_DEFINITIONS["SIZE_ESCALATION"]["points"],
                        "metadata": {
                            "position_size": current_trade.position_size,
                            "baseline_avg": self.baseline.avg_position_size,
                            "ratio_to_baseline": round(current_trade.position_size / max(1.0, self.baseline.avg_position_size), 2),
                            "prior_trade_loss": prev_trade.pnl
                        }
                    })

        # -------------------------------------------------------------
        # Rule 5: SAME_TICKER_FIXATION (3+ trades same instrument in 30 min) -> +15
        # -------------------------------------------------------------
        thirty_mins_ago = trade_time - timedelta(minutes=30)
        recent_same_ticker = [
            t for t in history
            if t.instrument == current_trade.instrument and t.timestamp and t.timestamp >= thirty_mins_ago
        ]
        # Including current trade
        total_recent_ticker = len(recent_same_ticker) + 1
        if total_recent_ticker >= 3:
            triggered.append({
                "event_type": "SAME_TICKER_FIXATION",
                "points_added": RULE_DEFINITIONS["SAME_TICKER_FIXATION"]["points"],
                "metadata": {
                    "instrument": current_trade.instrument,
                    "trades_in_30min": total_recent_ticker,
                    "window_minutes": 30
                }
            })

        # -------------------------------------------------------------
        # Rule 6: OUTSIDE_SESSION (trade outside trader's defined active hours) -> +25
        # -------------------------------------------------------------
        if self._is_outside_active_hours(trade_time):
            triggered.append({
                "event_type": "OUTSIDE_SESSION",
                "points_added": RULE_DEFINITIONS["OUTSIDE_SESSION"]["points"],
                "metadata": {
                    "trade_time": trade_time.strftime("%H:%M:%S"),
                    "active_hours": self.baseline.active_session_hours
                }
            })

        # -------------------------------------------------------------
        # Rule 7: FREQUENCY_SPIKE (trades/hour > 2x trader's hourly baseline) -> +15
        # -------------------------------------------------------------
        one_hour_ago = trade_time - timedelta(hours=1)
        trades_last_hour = len([
            t for t in history
            if t.timestamp and t.timestamp >= one_hour_ago
        ]) + 1  # include current trade
        
        freq_threshold = 2.0 * max(0.5, self.baseline.avg_trades_per_hour)
        if trades_last_hour > freq_threshold:
            triggered.append({
                "event_type": "FREQUENCY_SPIKE",
                "points_added": RULE_DEFINITIONS["FREQUENCY_SPIKE"]["points"],
                "metadata": {
                    "trades_last_hour": trades_last_hour,
                    "baseline_hourly": self.baseline.avg_trades_per_hour,
                    "threshold": freq_threshold
                }
            })

        # -------------------------------------------------------------
        # Rule 8: FOMO_CHASE (entry after move already 70%+ extended (use ATR)) -> +10
        # -------------------------------------------------------------
        # If extension_ratio is >= 0.70 or notes/setup indicates FOMO extension
        extension = getattr(current_trade, "extension_ratio", 0.0) or 0.0
        setup = (getattr(current_trade, "setup_pattern", "") or "").upper()
        if extension >= 0.70 or "FOMO" in setup:
            triggered.append({
                "event_type": "FOMO_CHASE",
                "points_added": RULE_DEFINITIONS["FOMO_CHASE"]["points"],
                "metadata": {
                    "extension_ratio": extension,
                    "atr": getattr(current_trade, "atr", 1.0)
                }
            })

        # -------------------------------------------------------------
        # Rule 9: OVERCONFIDENCE (position size 2x+ after 3 consecutive wins) -> +10
        # -------------------------------------------------------------
        consecutive_wins = 0
        for prev in reversed(history):
            if prev.pnl > 0:
                consecutive_wins += 1
            else:
                break
        
        if consecutive_wins >= 3 and current_trade.position_size >= (2.0 * self.baseline.avg_position_size):
            triggered.append({
                "event_type": "OVERCONFIDENCE",
                "points_added": RULE_DEFINITIONS["OVERCONFIDENCE"]["points"],
                "metadata": {
                    "consecutive_wins": consecutive_wins,
                    "position_size": current_trade.position_size,
                    "baseline_avg": self.baseline.avg_position_size,
                    "ratio": round(current_trade.position_size / max(1.0, self.baseline.avg_position_size), 2)
                }
            })

        # -------------------------------------------------------------
        # Rule 10: BOREDOM_TRADE (low ATR environment + no clear setup pattern) -> +10
        # -------------------------------------------------------------
        atr = getattr(current_trade, "atr", 1.0)
        setup_pattern = (getattr(current_trade, "setup_pattern", "") or "").upper()
        is_low_atr = atr is not None and atr <= 0.6
        is_poor_setup = setup_pattern in ["NONE", "CHOP", "BOREDOM", "NO_SETUP", "RANDOM", ""]
        if is_low_atr and is_poor_setup:
            triggered.append({
                "event_type": "BOREDOM_TRADE",
                "points_added": RULE_DEFINITIONS["BOREDOM_TRADE"]["points"],
                "metadata": {
                    "atr": atr,
                    "setup_pattern": setup_pattern
                }
            })

        # Sum points
        added_points = sum(event["points_added"] for event in triggered)
        new_score = min(100, max(0, effective_score + added_points))
        status = self.score_to_status(new_score)

        return triggered, new_score, status

    @staticmethod
    def score_to_status(score: int) -> str:
        if score <= 30:
            return "green"
        elif score <= 60:
            return "yellow"
        elif score <= 90:
            return "orange"
        else:
            return "red"

    def _is_outside_active_hours(self, dt: datetime) -> bool:
        """
        Checks if dt.time() is outside active_session_hours (e.g. '09:30-16:00')
        """
        hours_str = self.baseline.active_session_hours
        if not hours_str or "-" not in hours_str:
            return False
        try:
            start_str, end_str = hours_str.strip().split("-")
            sh, sm = map(int, start_str.split(":"))
            eh, em = map(int, end_str.split(":"))
            start_time = time(sh, sm)
            end_time = time(eh, em)

            trade_t = dt.time()
            if start_time <= end_time:
                # Normal window e.g. 09:30 to 16:00
                return not (start_time <= trade_t <= end_time)
            else:
                # Overnight window e.g. 20:00 to 04:00
                return not (trade_t >= start_time or trade_t <= end_time)
        except Exception:
            return False
