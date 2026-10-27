import React from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { 
  Table, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  Flame, 
  Zap, 
  Clock, 
  ShieldAlert,
  HelpCircle 
} from 'lucide-react';

export const TradeHistoryTable: React.FC = () => {
  const { trades, events } = useTilt();
  const { formatCurrency, formatNumber } = useCurrency();

  // Helper to get rule flag icon and color
  const getRuleBadge = (ruleName: string) => {
    switch (ruleName) {
      case 'REVENGE_REENTRY':
        return {
          icon: <Flame className="w-3 h-3 text-[#ff3b3b]" />,
          bg: 'bg-[#ff3b3b]/15 text-[#ff3b3b] border-[#ff3b3b]/40',
          short: 'REVENGE',
        };
      case 'CONSECUTIVE_LOSS':
        return {
          icon: <AlertTriangle className="w-3 h-3 text-[#ff3b3b]" />,
          bg: 'bg-[#ff3b3b]/15 text-[#ff3b3b] border-[#ff3b3b]/40',
          short: '3x LOSS',
        };
      case 'SIZE_ESCALATION':
        return {
          icon: <Zap className="w-3 h-3 text-[#ff8800]" />,
          bg: 'bg-[#ff8800]/15 text-[#ff8800] border-[#ff8800]/40',
          short: 'SIZE > 1.5x',
        };
      case 'SAME_TICKER_FIXATION':
        return {
          icon: <Clock className="w-3 h-3 text-[#ffd700]" />,
          bg: 'bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40',
          short: 'FIXATION',
        };
      case 'FREQUENCY_SPIKE':
        return {
          icon: <Zap className="w-3 h-3 text-[#ffd700]" />,
          bg: 'bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40',
          short: 'FREQ SPIKE',
        };
      case 'OUTSIDE_SESSION':
        return {
          icon: <Clock className="w-3 h-3 text-[#ff3b3b]" />,
          bg: 'bg-[#ff3b3b]/15 text-[#ff3b3b] border-[#ff3b3b]/40',
          short: 'OFF HOURS',
        };
      case 'FOMO_CHASE':
        return {
          icon: <AlertTriangle className="w-3 h-3 text-[#ffd700]" />,
          bg: 'bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40',
          short: 'FOMO 70%+',
        };
      case 'OVERCONFIDENCE':
        return {
          icon: <Zap className="w-3 h-3 text-[#ffd700]" />,
          bg: 'bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40',
          short: 'OVERCONF 2x',
        };
      case 'BOREDOM_TRADE':
        return {
          icon: <HelpCircle className="w-3 h-3 text-slate-400" />,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          short: 'BOREDOM',
        };
      default:
        return {
          icon: <ShieldAlert className="w-3 h-3 text-[#ffd700]" />,
          bg: 'bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/30',
          short: ruleName.replace(/_/g, ' '),
        };
    }
  };

  return (
    <div className="bb-card rounded-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1e2530] mb-4">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-[#ff6600]" />
          <div>
            <h3 className="bb-header text-xs tracking-wider">
              Intraday Trade History & Behavioral Flags
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Real-time Trade Execution Audit // Triggered Tilt Rule Matrix
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Total Executions:</span>
          <span className="text-white font-bold bg-[#141820] px-2 py-0.5 rounded border border-[#1e2530]">
            {trades.length}
          </span>
        </div>
      </div>

      {/* Responsive Table with Sticky First 2 Columns on Mobile */}
      <div className="overflow-x-auto relative rounded-lg border border-[#1e2530] max-h-96 overflow-y-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead className="bg-[#141820] text-[#ff6600] text-[10px] uppercase tracking-wider sticky top-0 z-20 border-b border-[#1e2530]">
            <tr>
              {/* Sticky Column 1 */}
              <th className="py-2.5 px-3 sticky left-0 z-30 bg-[#141820] border-r border-[#1e2530] min-w-[75px]">
                Time
              </th>
              {/* Sticky Column 2 */}
              <th className="py-2.5 px-3 sticky left-[75px] z-30 bg-[#141820] border-r border-[#1e2530] min-w-[110px]">
                Ticker
              </th>
              <th className="py-2.5 px-3 min-w-[80px]">Side</th>
              <th className="py-2.5 px-3 text-right min-w-[70px]">Qty</th>
              <th className="py-2.5 px-3 text-right min-w-[90px]">Entry</th>
              <th className="py-2.5 px-3 text-right min-w-[90px]">Exit</th>
              <th className="py-2.5 px-3 text-right min-w-[110px]">P&L</th>
              <th className="py-2.5 px-3 text-center min-w-[90px]">Tilt Score</th>
              <th className="py-2.5 px-3 min-w-[180px]">Behavioral Rule Flags</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1e2530]/80">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 font-mono text-xs">
                  <Table className="w-8 h-8 text-[#ff6600]/30 mx-auto mb-2" />
                  NO EXECUTED TRADES IN CURRENT SESSION
                </td>
              </tr>
            ) : (
              trades.map((t, idx) => {
                const isWin = Number(t.pnl) > 0;
                const isLoss = Number(t.pnl) < 0;
                const timeStr = t.timestamp
                  ? new Date(t.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--';

                // Find matching tilt events for this trade
                const matchedEvents = (events || []).filter(
                  (ev) => ev.trade_id === t.id
                );

                const isLong = t.trade_type?.toLowerCase() === 'long';

                return (
                  <tr
                    key={t.id || `trade-${idx}`}
                    className="hover:bg-[#141820] transition-colors group"
                  >
                    {/* Sticky Column 1: Time */}
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] sticky left-0 z-10 bg-[#0f1218] group-hover:bg-[#141820] border-r border-[#1e2530]">
                      {timeStr}
                    </td>

                    {/* Sticky Column 2: Ticker */}
                    <td className="py-2.5 px-3 font-bold text-white tracking-wide sticky left-[75px] z-10 bg-[#0f1218] group-hover:bg-[#141820] border-r border-[#1e2530]">
                      {t.instrument}
                    </td>

                    {/* Side */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isLong
                            ? 'bg-[#00d084]/15 text-[#00d084] border border-[#00d084]/30'
                            : 'bg-[#ff3b3b]/15 text-[#ff3b3b] border border-[#ff3b3b]/40'
                        }`}
                      >
                        {isLong ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {t.trade_type?.toUpperCase() || 'BUY'}
                      </span>
                    </td>

                    {/* Qty */}
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {formatNumber(t.position_size)}
                    </td>

                    {/* Entry Price */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {formatNumber(t.entry_price, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Exit Price */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {formatNumber(t.exit_price, { minimumFractionDigits: 2 })}
                    </td>

                    {/* PnL */}
                    <td
                      className={`py-2.5 px-3 text-right font-bold text-sm ${
                        isWin
                          ? 'text-[#00d084]'
                          : isLoss
                          ? 'text-[#ff3b3b]'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(t.pnl, { showSign: true })}
                    </td>

                    {/* Tilt Score Column */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          matchedEvents.length > 0
                            ? 'bg-[#ff6600]/20 text-[#ff6600] border-[#ff6600]/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {matchedEvents.reduce((acc, ev) => acc + (ev.points_added || 0), 0) > 0
                          ? `+${matchedEvents.reduce((acc, ev) => acc + (ev.points_added || 0), 0)} pts`
                          : 'NOMINAL'}
                      </span>
                    </td>

                    {/* Behavioral Rule Flags */}
                    <td className="py-2.5 px-3">
                      {matchedEvents.length === 0 ? (
                        <span className="text-[10px] text-slate-600 italic">
                          No tilt flags triggered
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {matchedEvents.map((ev, eIdx) => {
                            const badge = getRuleBadge(ev.event_type);
                            return (
                              <span
                                key={`flag-${eIdx}`}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${badge.bg}`}
                                title={`${ev.event_type} (+${ev.points_added} pts)`}
                              >
                                {badge.icon}
                                <span>{badge.short}</span>
                                <span className="opacity-80 font-mono">
                                  +{ev.points_added}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
