import React from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { TiltGauge } from '../components/TiltGauge';
import { KillSwitchBanner } from '../components/KillSwitchBanner';
import { ActiveSessionStats } from '../components/ActiveSessionStats';
import { TiltEventFeed } from '../components/TiltEventFeed';
import { TradeForm } from '../components/TradeForm';
import { Table, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { trades } = useTilt();
  const { formatCurrency } = useCurrency();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Dynamic Kill Switch Banner (when Yellow/Orange/Red) */}
      <KillSwitchBanner />

      {/* Metric Cards */}
      <ActiveSessionStats />

      {/* Main Grid: Left = Gauge & Form, Right = Event Stream & Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <TiltGauge />
          <TradeForm />
        </div>

        {/* Right Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <TiltEventFeed />

          {/* Session Trades History */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
                  Recent Session Trades
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {trades.length} recorded
              </span>
            </div>

            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[11px] text-slate-400 bg-slate-900/80 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">Time</th>
                    <th className="py-2 px-2.5">Ticker</th>
                    <th className="py-2 px-2.5">Type</th>
                    <th className="py-2 px-2.5">Size</th>
                    <th className="py-2 px-2.5">Entry/Exit</th>
                    <th className="py-2 px-2.5 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No trades executed in this session yet.
                      </td>
                    </tr>
                  ) : (
                    trades.map((t, i) => {
                      const isWin = t.pnl > 0;
                      const timeStr = t.timestamp
                        ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--';

                      return (
                        <tr key={t.id || i} className="hover:bg-slate-850 transition-colors">
                          <td className="py-2 px-2.5 text-slate-400">{timeStr}</td>
                          <td className="py-2 px-2.5 font-bold text-white">{t.instrument}</td>
                          <td className="py-2 px-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.trade_type === 'long'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {t.trade_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-300">{t.position_size}</td>
                          <td className="py-2 px-2.5 text-slate-400 text-[11px]">
                            {t.entry_price} → {t.exit_price}
                          </td>
                          <td className={`py-2 px-2.5 text-right font-bold ${
                            isWin ? 'text-emerald-400' : t.pnl < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {formatCurrency(t.pnl, { showSign: true })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
