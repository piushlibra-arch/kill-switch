import React from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { TiltEvent } from '../types';
import { Zap, AlertTriangle, Clock, ArrowUpRight } from 'lucide-react';

const RULE_METAS: Record<string, { label: string; desc: string; badge: string }> = {
  LOSS_OCCURRED: {
    label: 'Loss Incurred',
    desc: 'Negative PnL recorded on exit',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  REVENGE_REENTRY: {
    label: 'Revenge Re-entry',
    desc: 'Re-entered same ticker < 3m after loss',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse',
  },
  CONSECUTIVE_LOSS: {
    label: 'Consecutive Loss',
    desc: '3+ consecutive loss streak',
    badge: 'bg-red-600/20 text-red-300 border-red-500/40',
  },
  SIZE_ESCALATION: {
    label: 'Size Escalation',
    desc: 'Position size > 1.5x baseline after loss',
    badge: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
  },
  SAME_TICKER_FIXATION: {
    label: 'Ticker Fixation',
    desc: '3+ trades on same instrument in 30 min',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  OUTSIDE_SESSION: {
    label: 'Outside Active Hours',
    desc: 'Traded outside defined baseline window',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  FREQUENCY_SPIKE: {
    label: 'Frequency Spike',
    desc: 'Execution frequency > 2x hourly baseline',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
  FOMO_CHASE: {
    label: 'FOMO Chase',
    desc: 'Entered move 70%+ extended on ATR',
    badge: 'bg-orange-400/20 text-orange-200 border-orange-400/40',
  },
  OVERCONFIDENCE: {
    label: 'Overconfidence Sizing',
    desc: '2x+ position size after 3 consecutive wins',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  BOREDOM_TRADE: {
    label: 'Boredom Trade',
    desc: 'Executed in low volatility with no defined setup',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  },
};

export const TiltEventFeed: React.FC = () => {
  const { events } = useTilt();
  const { formatCurrency } = useCurrency();

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Tilt Trigger Stream
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {events.length} trigger{events.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Events List */}
      <div className="overflow-y-auto space-y-2.5 mt-3 pr-1.5 flex-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-xs font-medium text-slate-400">No Tilt Events Yet</p>
            <p className="text-[11px] text-slate-600 max-w-xs mt-1">
              Events will populate in real-time as the rules engine detects behavioral anomalies or losses.
            </p>
          </div>
        ) : (
          events.map((ev, idx) => {
            const meta = RULE_METAS[ev.event_type] || {
              label: ev.event_type,
              desc: 'Custom rule trigger',
              badge: 'bg-slate-700/50 text-slate-300 border-slate-600',
            };

            const timeStr = ev.timestamp
              ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'just now';

            return (
              <div
                key={ev.id || `${ev.event_type}-${idx}`}
                className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${meta.badge}`}>
                      +{ev.points_added} pts
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {meta.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {timeStr}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">
                  {meta.desc}
                </p>

                {/* Additional event metadata details if present */}
                {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                    {ev.metadata.instrument && (
                      <span className="text-slate-300">Ticker: <strong className="text-white">{ev.metadata.instrument}</strong></span>
                    )}
                    {ev.metadata.pnl !== undefined && (
                      <span className={ev.metadata.pnl < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        PnL: {formatCurrency(ev.metadata.pnl, { showSign: true })}
                      </span>
                    )}
                    {ev.metadata.seconds_since_loss !== undefined && (
                      <span className="text-amber-400">
                        {ev.metadata.seconds_since_loss}s after loss
                      </span>
                    )}
                    {ev.metadata.consecutive_loss_streak !== undefined && (
                      <span className="text-rose-400 font-bold">
                        {ev.metadata.consecutive_loss_streak} in a row
                      </span>
                    )}
                    {ev.metadata.ratio_to_baseline !== undefined && (
                      <span className="text-orange-400">
                        {ev.metadata.ratio_to_baseline}x baseline size
                      </span>
                    )}
                    {ev.metadata.extension_ratio !== undefined && (
                      <span className="text-amber-300">
                        {Math.round(ev.metadata.extension_ratio * 100)}% extended
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
