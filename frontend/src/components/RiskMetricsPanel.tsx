import React from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { ShieldAlert, AlertTriangle, Scale, Gauge, Lock } from 'lucide-react';

export const RiskMetricsPanel: React.FC = () => {
  const { currentScore, status, trades, baseline, softLockActive, hardLockActive } = useTilt();
  const { formatCurrency, formatNumber, currencySymbol } = useCurrency();

  // 1. Daily Loss Limit
  const currentLosses = Math.abs(
    (trades || [])
      .filter((t) => Number(t.pnl) < 0)
      .reduce((acc, t) => acc + Number(t.pnl), 0)
  );
  // Estimate daily loss budget based on baseline size or standard 25x size
  const dailyLossLimit = baseline?.avg_position_size
    ? baseline.avg_position_size * 200
    : 50000;
  const lossPct = Math.min(100, Math.round((currentLosses / Math.max(1, dailyLossLimit)) * 100));

  // 2. Position Size Limit (1.5x escalation baseline)
  const latestTradeSize = trades && trades.length > 0 ? trades[0].position_size : (baseline?.avg_position_size || 50);
  const baselineSize = baseline?.avg_position_size || 50;
  const escalationLimit = baselineSize * 1.5;
  const sizeRatio = latestTradeSize / baselineSize;
  const sizePct = Math.min(100, Math.round((latestTradeSize / (escalationLimit * 1.2)) * 100));

  // 3. Tilt Score Budget (0 to 100)
  const tiltPct = Math.min(100, Math.max(0, currentScore));
  const getTiltColor = (score: number) => {
    if (score <= 30) return '#00d084';
    if (score <= 60) return '#ffd700';
    if (score <= 90) return '#ff8800';
    return '#ff3b3b';
  };

  return (
    <div className="bb-card rounded-xl p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e2530] mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#ff6600]" />
          <div>
            <h3 className="bb-header text-xs tracking-wider">
              Risk & Exposure Monitor
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Intraday Limits & Tilt Safety Budgets
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          {hardLockActive ? (
            <span className="px-2 py-0.5 rounded bg-[#ff3b3b]/20 border border-[#ff3b3b]/40 text-[#ff3b3b] font-bold animate-pulse flex items-center gap-1">
              <Lock className="w-3 h-3" />
              HARD LOCKED
            </span>
          ) : softLockActive ? (
            <span className="px-2 py-0.5 rounded bg-[#ff8800]/20 border border-[#ff8800]/40 text-[#ff8800] font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              SOFT LOCKED
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-[#00d084]/15 border border-[#00d084]/30 text-[#00d084] font-bold">
              NOMINAL
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 font-mono">
        {/* Metric 1: Daily Loss Limit */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="bb-label text-[10px]">Daily Loss Budget</span>
            <span className="text-white text-xs">
              <span className={lossPct > 75 ? 'text-[#ff3b3b] font-bold' : 'text-slate-300'}>
                {formatCurrency(currentLosses)}
              </span>
              <span className="text-slate-500 text-[10px]"> / {formatCurrency(dailyLossLimit)}</span>
            </span>
          </div>

          <div className="w-full bg-[#141820] h-2 rounded-full overflow-hidden border border-[#1e2530] relative">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${lossPct}%`,
                backgroundColor: lossPct > 80 ? '#ff3b3b' : lossPct > 50 ? '#ffd700' : '#00d084',
              }}
            />
          </div>

          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>0%</span>
            <span>Threshold Warning (70%)</span>
            <span>{lossPct}% Utilized</span>
          </div>
        </div>

        {/* Metric 2: Position Size Escalation Monitor */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="bb-label text-[10px]">Position Size vs 1.5x Limit</span>
            <span className="text-white text-xs">
              <span className={sizeRatio > 1.4 ? 'text-[#ff8800] font-bold' : 'text-slate-300'}>
                {formatNumber(latestTradeSize)}
              </span>
              <span className="text-slate-500 text-[10px]">
                {' '}(Base: {formatNumber(baselineSize)} | Max: {formatNumber(escalationLimit)})
              </span>
            </span>
          </div>

          <div className="w-full bg-[#141820] h-2 rounded-full overflow-hidden border border-[#1e2530] relative">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${sizePct}%`,
                backgroundColor: sizeRatio >= 1.5 ? '#ff3b3b' : sizeRatio >= 1.2 ? '#ff8800' : '#00d084',
              }}
            />
          </div>

          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>1.0x Baseline</span>
            <span className="text-[#ff6600]">1.5x Escalation Cap</span>
            <span>{sizeRatio.toFixed(2)}x Current</span>
          </div>
        </div>

        {/* Metric 3: Tilt Score Budget Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="bb-label text-[10px]">Tilt Budget (Score / 100)</span>
            <span className="text-xs font-bold" style={{ color: getTiltColor(currentScore) }}>
              {currentScore} / 100 PTS ({status.toUpperCase()})
            </span>
          </div>

          {/* Stepped progress bar with 30, 60, 90 tick markers */}
          <div className="relative w-full bg-[#141820] h-3 rounded-full overflow-hidden border border-[#1e2530]">
            {/* Zone segment background markers */}
            <div className="absolute inset-0 flex pointer-events-none">
              <div className="w-[30%] border-r border-[#2a3545]/60" />
              <div className="w-[30%] border-r border-[#2a3545]/60" />
              <div className="w-[30%] border-r border-[#2a3545]/60" />
              <div className="w-[10%]" />
            </div>

            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${tiltPct}%`,
                backgroundColor: getTiltColor(currentScore),
                boxShadow: `0 0 12px ${getTiltColor(currentScore)}80`,
              }}
            />
          </div>

          {/* Zone Legend */}
          <div className="grid grid-cols-4 text-[9px] font-mono text-center mt-1 text-slate-400">
            <span className="text-left text-[#00d084]">0-30 GREEN</span>
            <span className="text-[#ffd700]">31-60 YELLOW</span>
            <span className="text-[#ff8800]">61-90 ORANGE</span>
            <span className="text-right text-[#ff3b3b]">90+ RED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
