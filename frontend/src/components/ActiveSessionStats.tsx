import React, { useMemo } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { TrendingUp, TrendingDown, Flame, Clock, Award, ShieldAlert } from 'lucide-react';

export const ActiveSessionStats: React.FC = () => {
  const { trades, events, baseline } = useTilt();
  const { formatCurrency, formatNumber, currencySymbol } = useCurrency();

  const totalTrades = trades.length;
  const wins = trades.filter((t) => Number(t.pnl) > 0).length;
  const losses = trades.filter((t) => Number(t.pnl) < 0).length;
  const totalPnL = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  // Max Drawdown calculation
  const { maxDrawdown, peakEquity } = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { maxDrawdown: 0, peakEquity: 0 };
    }

    const sorted = [...trades].sort((a, b) => {
      return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
    });

    let running = 0;
    let peak = 0;
    let maxDd = 0;

    sorted.forEach((t) => {
      running += Number(t.pnl) || 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDd) maxDd = dd;
    });

    return { maxDrawdown: maxDd, peakEquity: peak };
  }, [trades]);

  // Risk / Reward Ratio calculation
  const { rrRatio, avgWin, avgLoss } = useMemo(() => {
    const winTrades = trades.filter((t) => Number(t.pnl) > 0);
    const lossTrades = trades.filter((t) => Number(t.pnl) < 0);

    const aWin = winTrades.length > 0 
      ? winTrades.reduce((acc, t) => acc + Number(t.pnl), 0) / winTrades.length 
      : 0;

    const aLoss = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((acc, t) => acc + Number(t.pnl), 0)) / lossTrades.length 
      : 0;

    let ratio = '1.00';
    if (aLoss > 0) {
      ratio = (aWin / aLoss).toFixed(2);
    } else if (aWin > 0) {
      ratio = '∞';
    }

    return { rrRatio: ratio, avgWin: aWin, avgLoss: aLoss };
  }, [trades]);

  // Streak Counter calculation (from most recent trades)
  const streak = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { count: 0, type: 'NONE' };
    }

    // Most recent is index 0
    const firstPnl = Number(trades[0].pnl) || 0;
    const type: 'WIN' | 'LOSS' = firstPnl >= 0 ? 'WIN' : 'LOSS';
    let count = 0;

    for (const t of trades) {
      const pnl = Number(t.pnl) || 0;
      if ((type === 'WIN' && pnl >= 0) || (type === 'LOSS' && pnl < 0)) {
        count++;
      } else {
        break;
      }
    }

    return { count, type };
  }, [trades]);

  // Time in Market & Pace
  const { totalTimeFormatted, avgDurationSec, tradesPerHour } = useMemo(() => {
    const totalSec = trades.reduce((acc, t) => acc + (t.duration_seconds || 60), 0);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let timeStr = `${mins}m ${secs}s`;
    if (hours > 0) {
      timeStr = `${hours}h ${mins}m`;
    }

    const avgSec = totalTrades > 0 ? Math.round(totalSec / totalTrades) : 0;
    const p = baseline?.avg_trades_per_hour || 4;

    return { totalTimeFormatted: timeStr, avgDurationSec: avgSec, tradesPerHour: p };
  }, [trades, baseline, totalTrades]);

  const isNetProfit = totalPnL >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {/* 1. Net Session PnL */}
      <div className="bb-card rounded-xl p-3.5 flex flex-col justify-between">
        <div>
          <span className="bb-label flex items-center justify-between">
            <span>Net Session P&L</span>
            {isNetProfit ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#00d084]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[#ff3b3b]" />
            )}
          </span>
          <div
            className={`font-mono font-bold text-2xl tracking-tight mt-1 truncate ${
              isNetProfit ? 'text-[#00d084]' : 'text-[#ff3b3b]'
            }`}
          >
            {formatCurrency(totalPnL, { showSign: true })}
          </div>
        </div>

        <div>
          <div className="border-t border-[#1e2530] my-2" />
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>WR: <strong className="text-white">{winRate}%</strong></span>
            <span>{wins}W / {losses}L ({totalTrades})</span>
          </div>
        </div>
      </div>

      {/* 2. Max Drawdown */}
      <div className="bb-card rounded-xl p-3.5 flex flex-col justify-between">
        <div>
          <span className="bb-label flex items-center justify-between">
            <span>Max Drawdown</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[#ff3b3b]" />
          </span>
          <div className="font-mono font-bold text-2xl tracking-tight mt-1 text-white truncate">
            {maxDrawdown > 0 ? `-${formatCurrency(maxDrawdown)}` : formatCurrency(0)}
          </div>
        </div>

        <div>
          <div className="border-t border-[#1e2530] my-2" />
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Peak: <strong className="text-[#00d084]">+{formatCurrency(peakEquity)}</strong></span>
            <span>{peakEquity > 0 ? ((maxDrawdown / peakEquity) * 100).toFixed(1) : 0}% drop</span>
          </div>
        </div>
      </div>

      {/* 3. Risk / Reward */}
      <div className="bb-card rounded-xl p-3.5 flex flex-col justify-between">
        <div>
          <span className="bb-label flex items-center justify-between">
            <span>Risk / Reward</span>
            <span className="text-[9px] font-mono text-slate-500">PAYOFF</span>
          </span>
          <div className="font-mono font-bold text-2xl tracking-tight mt-1 text-white">
            {rrRatio} <span className="text-xs text-slate-400 font-normal">: 1</span>
          </div>
        </div>

        <div>
          <div className="border-t border-[#1e2530] my-2" />
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between truncate">
            <span>Avg W: <strong className="text-[#00d084]">+{formatCurrency(avgWin)}</strong></span>
            <span>Avg L: <strong className="text-[#ff3b3b]">-{formatCurrency(avgLoss)}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Streak Counter */}
      <div className="bb-card rounded-xl p-3.5 flex flex-col justify-between">
        <div>
          <span className="bb-label flex items-center justify-between">
            <span>Streak Counter</span>
            <Flame
              className={`w-3.5 h-3.5 ${
                streak.type === 'WIN'
                  ? 'text-[#00d084]'
                  : streak.type === 'LOSS'
                  ? 'text-[#ff3b3b]'
                  : 'text-slate-500'
              }`}
            />
          </span>
          <div
            className={`font-mono font-bold text-2xl tracking-tight mt-1 ${
              streak.type === 'WIN'
                ? 'text-[#00d084]'
                : streak.type === 'LOSS'
                ? 'text-[#ff3b3b]'
                : 'text-slate-300'
            }`}
          >
            {streak.count > 0 ? (
              <span>
                {streak.count} {streak.type}{streak.count > 1 ? 'S' : ''}
              </span>
            ) : (
              <span>0 NONE</span>
            )}
          </div>
        </div>

        <div>
          <div className="border-t border-[#1e2530] my-2" />
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Discipline Pace</span>
            <span className="text-white">{totalTrades > 0 ? `${wins} Win / ${losses} Loss` : 'Ready'}</span>
          </div>
        </div>
      </div>

      {/* 5. Time In Market */}
      <div className="bb-card rounded-xl p-3.5 col-span-2 md:col-span-1 flex flex-col justify-between">
        <div>
          <span className="bb-label flex items-center justify-between">
            <span>Time In Market</span>
            <Clock className="w-3.5 h-3.5 text-[#ff6600]" />
          </span>
          <div className="font-mono font-bold text-2xl tracking-tight mt-1 text-white">
            {totalTimeFormatted}
          </div>
        </div>

        <div>
          <div className="border-t border-[#1e2530] my-2" />
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Avg Hold: <strong className="text-white">{avgDurationSec}s</strong></span>
            <span>Target: {tradesPerHour} tr/hr</span>
          </div>
        </div>
      </div>
    </div>
  );
};
