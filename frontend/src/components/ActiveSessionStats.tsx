import React from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { Target, TrendingUp, AlertCircle, Scale, Coins } from 'lucide-react';

export const ActiveSessionStats: React.FC = () => {
  const { trades, events, currentScore, baseline } = useTilt();
  const { formatCurrency, currencySymbol } = useCurrency();

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const revengeEvents = events.filter((e) => e.event_type === 'REVENGE_REENTRY');
  const sizeEscalations = events.filter((e) => e.event_type === 'SIZE_ESCALATION');

  const avgSize = totalTrades > 0 
    ? Math.round(trades.reduce((sum, t) => sum + (t.position_size || 0), 0) / totalTrades) 
    : baseline?.avg_position_size || 100;

  const baselineSize = baseline?.avg_position_size || 100;
  const sizeRatio = (avgSize / baselineSize).toFixed(1);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* PnL Card */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Session Realized PnL
          </span>
          <div className={`text-2xl font-black font-mono mt-1 ${
            totalPnL > 0 ? 'text-emerald-400' : totalPnL < 0 ? 'text-rose-400' : 'text-slate-200'
          }`}>
            {formatCurrency(totalPnL, { showSign: true })}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {wins}W / {losses}L across {totalTrades} executions
          </span>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          totalPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        }`}>
          <span className="text-xl font-bold font-mono">{currencySymbol}</span>
        </div>
      </div>

      {/* Win Rate */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Win Rate vs Baseline
          </span>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {winRate}%
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Baseline Target: {Math.round((baseline?.avg_win_rate || 0.55) * 100)}%
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
          <Target className="w-6 h-6" />
        </div>
      </div>

      {/* Sizing Discipline */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Avg Sizing Multiple
          </span>
          <div className={`text-2xl font-black font-mono mt-1 ${
            parseFloat(sizeRatio) > 1.5 ? 'text-orange-400' : 'text-white'
          }`}>
            {sizeRatio}x <span className="text-xs font-normal text-slate-400">({avgSize} lots)</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Baseline: {baselineSize} lots
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
          <Scale className="w-6 h-6" />
        </div>
      </div>

      {/* Revenge & Emotional Events */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Emotional Anomalies
          </span>
          <div className={`text-2xl font-black font-mono mt-1 ${
            revengeEvents.length > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {revengeEvents.length + sizeEscalations.length}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {revengeEvents.length} revenge • {sizeEscalations.length} size jumps
          </span>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          revengeEvents.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
        }`}>
          <AlertCircle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
