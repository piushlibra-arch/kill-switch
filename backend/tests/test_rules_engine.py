import pytest
from datetime import datetime, timedelta
from backend.app.models import Trade, TraderBaseline
from backend.app.rules_engine import RulesEngine, RULE_DEFINITIONS

@pytest.fixture
def baseline():
    b = TraderBaseline(
        trader_id="test_trader",
        avg_position_size=100.0,
        avg_trades_per_hour=3.0,
        preferred_instruments_json='["NQ", "ES", "AAPL"]',
        active_session_hours="09:30-16:00",
        avg_win_rate=0.6,
        avg_loss_rate=0.4,
        hard_lock_cooldown_minutes=30,
        soft_lock_cooldown_seconds=60
    )
    return b

def test_rule_1_loss_occurred(baseline):
    engine = RulesEngine(baseline)
    trade = Trade(
        id=1, trader_id="test_trader", session_id="s1", instrument="NQ",
        trade_type="long", entry_price=18000, exit_price=17950,
        position_size=100, pnl=-250.0,
        timestamp=datetime(2026, 10, 27, 10, 0, 0),
        duration_seconds=60
    )
    events, score, status = engine.evaluate_trade(trade, [], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "LOSS_OCCURRED" in event_types
    assert score == 10
    assert status == "green"

def test_rule_2_revenge_reentry(baseline):
    engine = RulesEngine(baseline)
    t1 = Trade(
        id=1, trader_id="test_trader", session_id="s1", instrument="NQ",
        trade_type="long", entry_price=18000, exit_price=17950,
        position_size=100, pnl=-200.0,
        timestamp=datetime(2026, 10, 27, 10, 0, 0)
    )
    # Trade 2 entered 90 seconds later on same instrument
    t2 = Trade(
        id=2, trader_id="test_trader", session_id="s1", instrument="NQ",
        trade_type="long", entry_price=17950, exit_price=18000,
        position_size=100, pnl=100.0,
        timestamp=datetime(2026, 10, 27, 10, 1, 30)
    )
    events, score, status = engine.evaluate_trade(t2, [t1], current_score=10)
    event_types = [e["event_type"] for e in events]
    assert "REVENGE_REENTRY" in event_types
    assert score == 30

def test_rule_3_consecutive_loss(baseline):
    engine = RulesEngine(baseline)
    t1 = Trade(id=1, trader_id="test_trader", session_id="s1", instrument="ES", trade_type="long", entry_price=5000, exit_price=4990, position_size=50, pnl=-100, timestamp=datetime(2026, 10, 27, 9, 35))
    t2 = Trade(id=2, trader_id="test_trader", session_id="s1", instrument="AAPL", trade_type="long", entry_price=180, exit_price=175, position_size=50, pnl=-50, timestamp=datetime(2026, 10, 27, 9, 45))
    t3 = Trade(id=3, trader_id="test_trader", session_id="s1", instrument="NQ", trade_type="long", entry_price=18000, exit_price=17900, position_size=50, pnl=-200, timestamp=datetime(2026, 10, 27, 10, 0))

    events, score, status = engine.evaluate_trade(t3, [t1, t2], current_score=20)
    event_types = [e["event_type"] for e in events]
    assert "LOSS_OCCURRED" in event_types
    assert "CONSECUTIVE_LOSS" in event_types
    # 20 + 10 (loss) + 15 (consecutive) = 45
    assert score == 45
    assert status == "yellow"

def test_rule_4_size_escalation(baseline):
    engine = RulesEngine(baseline)
    t1 = Trade(id=1, trader_id="test_trader", session_id="s1", instrument="NQ", trade_type="long", entry_price=18000, exit_price=17900, position_size=100, pnl=-300, timestamp=datetime(2026, 10, 27, 10, 0))
    # Baseline avg is 100. > 1.5x is > 150. Sizing 200 after loss
    t2 = Trade(id=2, trader_id="test_trader", session_id="s1", instrument="ES", trade_type="long", entry_price=5000, exit_price=5010, position_size=200, pnl=100, timestamp=datetime(2026, 10, 27, 10, 10))

    events, score, status = engine.evaluate_trade(t2, [t1], current_score=10)
    event_types = [e["event_type"] for e in events]
    assert "SIZE_ESCALATION" in event_types
    # 10 + 20 = 30
    assert score == 30

def test_rule_5_same_ticker_fixation(baseline):
    engine = RulesEngine(baseline)
    base_time = datetime(2026, 10, 27, 10, 0)
    t1 = Trade(id=1, trader_id="test_trader", session_id="s1", instrument="NVDA", trade_type="long", entry_price=800, exit_price=805, position_size=100, pnl=100, timestamp=base_time)
    t2 = Trade(id=2, trader_id="test_trader", session_id="s1", instrument="NVDA", trade_type="long", entry_price=805, exit_price=810, position_size=100, pnl=100, timestamp=base_time + timedelta(minutes=5))
    t3 = Trade(id=3, trader_id="test_trader", session_id="s1", instrument="NVDA", trade_type="short", entry_price=810, exit_price=808, position_size=100, pnl=50, timestamp=base_time + timedelta(minutes=12))

    events, score, status = engine.evaluate_trade(t3, [t1, t2], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "SAME_TICKER_FIXATION" in event_types
    assert score == 15

def test_rule_6_outside_session(baseline):
    engine = RulesEngine(baseline)
    # Active hours: 09:30-16:00. Trade at 08:15
    early_trade = Trade(id=1, trader_id="test_trader", session_id="s1", instrument="NQ", trade_type="long", entry_price=18000, exit_price=18050, position_size=100, pnl=150, timestamp=datetime(2026, 10, 27, 8, 15))
    events, score, status = engine.evaluate_trade(early_trade, [], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "OUTSIDE_SESSION" in event_types
    assert score == 25

def test_rule_7_frequency_spike(baseline):
    engine = RulesEngine(baseline)
    # Baseline avg trades/hour = 3.0. 2x is 6.0. So 7 trades in an hour triggers
    base_time = datetime(2026, 10, 27, 10, 0)
    priors = [
        Trade(id=i, trader_id="test_trader", session_id="s1", instrument=f"INST{i}", trade_type="long", entry_price=100, exit_price=101, position_size=50, pnl=10, timestamp=base_time + timedelta(minutes=i*5))
        for i in range(1, 7) # 6 trades
    ]
    t7 = Trade(id=7, trader_id="test_trader", session_id="s1", instrument="NQ", trade_type="long", entry_price=100, exit_price=101, position_size=50, pnl=10, timestamp=base_time + timedelta(minutes=35))
    events, score, status = engine.evaluate_trade(t7, priors, current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "FREQUENCY_SPIKE" in event_types
    assert score == 15

def test_rule_8_fomo_chase(baseline):
    engine = RulesEngine(baseline)
    trade = Trade(
        id=1, trader_id="test_trader", session_id="s1", instrument="TSLA",
        trade_type="long", entry_price=250, exit_price=255, position_size=100, pnl=100,
        timestamp=datetime(2026, 10, 27, 10, 0),
        atr=2.5, extension_ratio=0.85
    )
    events, score, status = engine.evaluate_trade(trade, [], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "FOMO_CHASE" in event_types
    assert score == 10

def test_rule_9_overconfidence(baseline):
    engine = RulesEngine(baseline)
    base_time = datetime(2026, 10, 27, 10, 0)
    t1 = Trade(id=1, trader_id="test_trader", session_id="s1", instrument="NQ", trade_type="long", entry_price=18000, exit_price=18050, position_size=100, pnl=200, timestamp=base_time)
    t2 = Trade(id=2, trader_id="test_trader", session_id="s1", instrument="ES", trade_type="long", entry_price=5000, exit_price=5020, position_size=100, pnl=200, timestamp=base_time + timedelta(minutes=5))
    t3 = Trade(id=3, trader_id="test_trader", session_id="s1", instrument="AAPL", trade_type="long", entry_price=180, exit_price=185, position_size=100, pnl=200, timestamp=base_time + timedelta(minutes=10))

    # 4th trade has position_size = 250 (>= 2x baseline of 100)
    t4 = Trade(id=4, trader_id="test_trader", session_id="s1", instrument="NVDA", trade_type="long", entry_price=800, exit_price=810, position_size=250, pnl=300, timestamp=base_time + timedelta(minutes=15))

    events, score, status = engine.evaluate_trade(t4, [t1, t2, t3], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "OVERCONFIDENCE" in event_types
    assert score == 10

def test_rule_10_boredom_trade(baseline):
    engine = RulesEngine(baseline)
    trade = Trade(
        id=1, trader_id="test_trader", session_id="s1", instrument="AAPL",
        trade_type="long", entry_price=180, exit_price=180.2, position_size=100, pnl=20,
        timestamp=datetime(2026, 10, 27, 10, 0),
        atr=0.4, setup_pattern="CHOP"
    )
    events, score, status = engine.evaluate_trade(trade, [], current_score=0)
    event_types = [e["event_type"] for e in events]
    assert "BOREDOM_TRADE" in event_types
    assert score == 10

def test_status_transitions(baseline):
    engine = RulesEngine(baseline)
    assert engine.score_to_status(0) == "green"
    assert engine.score_to_status(30) == "green"
    assert engine.score_to_status(31) == "yellow"
    assert engine.score_to_status(60) == "yellow"
    assert engine.score_to_status(61) == "orange"
    assert engine.score_to_status(90) == "orange"
    assert engine.score_to_status(91) == "red"
    assert engine.score_to_status(100) == "red"
