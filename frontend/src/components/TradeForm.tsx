import React, { useState } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { PlusCircle, Zap, TrendingUp, TrendingDown, Sparkles, AlertCircle } from 'lucide-react';

export const TradeForm: React.FC = () => {
  const { submitTrade, baseline, softLockActive, hardLockActive } = useTilt();
  const { currencySymbol, currencyCode } = useCurrency();

  const [instrument, setInstrument] = useState('NQ');
  const [tradeType, setTradeType] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('18200');
  const [exitPrice, setExitPrice] = useState('18230');
  const [positionSize, setPositionSize] = useState('100');
  const [pnl, setPnl] = useState('300');
  const [duration, setDuration] = useState('120');
  const [atr, setAtr] = useState('1.2');
  const [extensionRatio, setExtensionRatio] = useState('0.2');
  const [setupPattern, setSetupPattern] = useState('BREAKOUT');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [softConfirmPhrase, setSoftConfirmPhrase] = useState('');

  // Handle entry/exit price changes to automatically calculate reasonable PnL
  const handlePriceChange = (entry: string, exit: string, size: string, type: 'long' | 'short') => {
    const en = parseFloat(entry);
    const ex = parseFloat(exit);
    const sz = parseFloat(size);
    if (!isNaN(en) && !isNaN(ex) && !isNaN(sz)) {
      const mult = type === 'long' ? (ex - en) : (en - ex);
      // NQ point value or generic dollar multiplier
      const calculatedPnl = Math.round(mult * sz * 0.2);
      setPnl(calculatedPnl.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitTrade({
        instrument: instrument.trim().toUpperCase(),
        trade_type: tradeType,
        entry_price: parseFloat(entryPrice) || 100,
        exit_price: parseFloat(exitPrice) || 100,
        position_size: parseFloat(positionSize) || baseline?.avg_position_size || 100,
        pnl: parseFloat(pnl) || 0,
        duration_seconds: parseInt(duration) || 60,
        atr: parseFloat(atr) || 1.0,
        extension_ratio: parseFloat(extensionRatio) || 0.0,
        setup_pattern: setupPattern,
        notes: notes || undefined,
        soft_lock_confirmed_text: softConfirmPhrase || undefined,
      });
      // clear confirmation phrase after use
      setSoftConfirmPhrase('');
    } catch (err) {
      // error handled in context toast
    } finally {
      setLoading(false);
    }
  };

  // Quick Scenarios to easily demonstrate all 10 rules
  const applyScenario = (type: string) => {
    const now = new Date();
    switch (type) {
      case 'SAFE_WIN':
        setInstrument('NQ');
        setTradeType('long');
        setEntryPrice('18200');
        setExitPrice('18240');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('400');
        setAtr('1.2');
        setExtensionRatio('0.25');
        setSetupPattern('BREAKOUT');
        setNotes('Disciplined VWAP continuation setup');
        break;

      case 'LOSS':
        setInstrument('NQ');
        setTradeType('long');
        setEntryPrice('18240');
        setExitPrice('18210');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('-300');
        setAtr('1.2');
        setExtensionRatio('0.2');
        setSetupPattern('PULLBACK');
        setNotes('Stop loss triggered on re-test failure');
        break;

      case 'REVENGE_REENTRY':
        // Same ticker, rapid entry after loss
        setInstrument('NQ');
        setTradeType('long');
        setEntryPrice('18210');
        setExitPrice('18190');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('-200');
        setAtr('1.4');
        setExtensionRatio('0.3');
        setSetupPattern('NONE');
        setNotes('Immediate re-entry on same ticker after stop out');
        break;

      case 'SIZE_ESCALATION':
        // 2x position size after loss (martingale revenge)
        setInstrument('ES');
        setTradeType('long');
        setEntryPrice('5120');
        setExitPrice('5115');
        setPositionSize(((baseline?.avg_position_size || 100) * 2.2).toString());
        setPnl('-550');
        setAtr('1.3');
        setExtensionRatio('0.4');
        setSetupPattern('REVERSAL');
        setNotes('Revenge size escalation attempt to win back loss');
        break;

      case 'FOMO_CHASE':
        setInstrument('TSLA');
        setTradeType('long');
        setEntryPrice('255');
        setExitPrice('252');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('-180');
        setAtr('2.5');
        setExtensionRatio('0.85'); // > 70% extended
        setSetupPattern('FOMO');
        setNotes('Chased parabolic 5-minute candle at 85% ATR extension');
        break;

      case 'BOREDOM_TRADE':
        setInstrument('AAPL');
        setTradeType('short');
        setEntryPrice('180');
        setExitPrice('179.8');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('20');
        setAtr('0.35'); // low ATR <= 0.6
        setSetupPattern('CHOP'); // chop / no setup
        setNotes('Midday low volume chop trade with no defined edge');
        break;

      case 'OVERCONFIDENCE':
        // 2.5x size
        setInstrument('NVDA');
        setTradeType('long');
        setEntryPrice('880');
        setExitPrice('895');
        setPositionSize(((baseline?.avg_position_size || 100) * 2.5).toString());
        setPnl('750');
        setAtr('1.5');
        setExtensionRatio('0.3');
        setSetupPattern('BREAKOUT');
        setNotes('Overconfident aggressive sizing after multiple green trades');
        break;

      case 'OUTSIDE_HOURS':
        setInstrument('NQ');
        setTradeType('long');
        setEntryPrice('18200');
        setExitPrice('18230');
        setPositionSize((baseline?.avg_position_size || 100).toString());
        setPnl('250');
        setAtr('1.0');
        setExtensionRatio('0.2');
        setSetupPattern('BREAKOUT');
        setNotes('Late night futures execution outside trading plan hours');
        break;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Manual Trade Entry
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Evaluates All 10 Tilt Rules on Submit
        </span>
      </div>

      {/* Preset Scenarios Buttons */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Scenario Presets (Test Any Rule in 1 Click):</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => applyScenario('SAFE_WIN')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-all"
          >
            🟢 Safe Win (+0)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('LOSS')}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-all"
          >
            🔴 Standard Loss (+10)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('REVENGE_REENTRY')}
            className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/40 text-[11px] font-medium transition-all"
          >
            ⚡ Revenge Re-entry (+20)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('SIZE_ESCALATION')}
            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-medium transition-all"
          >
            📈 Size Escalation (+20)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('FOMO_CHASE')}
            className="px-2.5 py-1 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/40 text-[11px] font-medium transition-all"
          >
            🏃 FOMO Chase (+10)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('BOREDOM_TRADE')}
            className="px-2.5 py-1 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 border border-slate-600 text-[11px] font-medium transition-all"
          >
            😴 Boredom Trade (+10)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('OVERCONFIDENCE')}
            className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 text-[11px] font-medium transition-all"
          >
            💰 Overconfidence (+10)
          </button>
        </div>
      </div>

      {/* Main Trade Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Instrument */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Instrument
            </label>
            <input
              type="text"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value.toUpperCase())}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          {/* Type Toggle */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Direction
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setTradeType('long');
                  handlePriceChange(entryPrice, exitPrice, positionSize, 'long');
                }}
                className={`py-1 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${
                  tradeType === 'long'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3 h-3" /> LONG
              </button>
              <button
                type="button"
                onClick={() => {
                  setTradeType('short');
                  handlePriceChange(entryPrice, exitPrice, positionSize, 'short');
                }}
                className={`py-1 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${
                  tradeType === 'short'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-3 h-3" /> SHORT
              </button>
            </div>
          </div>

          {/* Position Size */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Size (Base: {baseline?.avg_position_size || 100})
            </label>
            <input
              type="number"
              step="any"
              value={positionSize}
              onChange={(e) => {
                setPositionSize(e.target.value);
                handlePriceChange(entryPrice, exitPrice, e.target.value, tradeType);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          {/* Realized PnL */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              PnL ({currencySymbol})
            </label>
            <input
              type="number"
              step="any"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-rose-500 ${
                parseFloat(pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
              required
            />
          </div>
        </div>

        {/* Price & Context Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Entry Price
            </label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => {
                setEntryPrice(e.target.value);
                handlePriceChange(e.target.value, exitPrice, positionSize, tradeType);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Exit Price
            </label>
            <input
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => {
                setExitPrice(e.target.value);
                handlePriceChange(entryPrice, e.target.value, positionSize, tradeType);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Setup Pattern
            </label>
            <select
              value={setupPattern}
              onChange={(e) => setSetupPattern(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
            >
              <option value="BREAKOUT">BREAKOUT</option>
              <option value="PULLBACK">PULLBACK</option>
              <option value="REVERSAL">REVERSAL</option>
              <option value="FOMO">FOMO / CHASE</option>
              <option value="CHOP">CHOP (Low quality)</option>
              <option value="NONE">NONE (Impulsive)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Extension Ratio ({Math.round(parseFloat(extensionRatio || '0') * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={extensionRatio}
              onChange={(e) => setExtensionRatio(e.target.value)}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Notes & Lock warnings */}
        <div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Trade execution thesis / notes (optional)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${
              hardLockActive
                ? 'bg-rose-950 border border-rose-500/60 text-rose-300 hover:bg-rose-900 shadow-lg shadow-rose-900/30'
                : softLockActive
                ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
            }`}
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Evaluating Rules...' : hardLockActive ? 'Submit (Will Challenge Kill Switch)' : 'Execute & Evaluate Trade'}
          </button>
        </div>
      </form>
    </div>
  );
};
