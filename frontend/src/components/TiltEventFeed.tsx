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
    <div className="bb-card rounded-xl p-4 sm:p-5 flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e2530] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#ff6600]" />
          <div>
            <h3 className="bb-header text-xs tracking-wider">
              Tilt Trigger Stream
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Live Behavioral Audit Stream
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-[#141820] px-2 py-0.5 rounded border border-[#1e2530]">
          {events.length} trigger{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Events List */}
      <div className="overflow-y-auto space-y-2 mt-3 pr-1 flex-1 font-mono">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-[#1e2530] rounded-lg">
            <Clock className="w-8 h-8 text-[#ff6600]/40 mb-2 animate-pulse" />
            <p className="text-xs font-mono text-slate-400">NO TILT TRIGGERS</p>
            <p className="text-[10px] text-slate-600 max-w-xs mt-0.5">
              Rules engine operates within baseline tolerances.
            </p>
          </div>
        ) : (
          events.map((ev, idx) => {
            const meta = RULE_METAS[ev.event_type] || {
              label: ev.event_type,
              desc: 'Custom rule trigger',
              badge: 'bg-[#141820] text-slate-300 border-[#1e2530]',
            };

            const timeStr = ev.timestamp
              ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'just now';

            return (
              <div
                key={ev.id || `${ev.event_type}-${idx}`}
                className="bg-[#141820] hover:bg-[#1a202c] border border-[#1e2530] hover:border-[#2a3545] rounded-lg p-2.5 transition-all text-xs"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${meta.badge}`}>
                      +{ev.points_added} pts
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide">
                      {meta.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
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
