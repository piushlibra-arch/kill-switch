import React, { useState, useEffect } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../api/client';
import { AnalyticsData } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Flame, 
  Clock, 
  RotateCw,
  Calendar,
  Layers
} from 'lucide-react';

export const Analytics: React.FC = () => {
  const { traderId } = useTilt();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(traderId);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [traderId]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
        <p className="text-sm font-mono">Aggregating Behavioral Telemetry...</p>
      </div>
    );
  }

  // Format timeline data for Recharts
  const timelineChartData = (data?.timeline || []).map((pt, idx) => ({
    name: pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${idx}`,
    score: pt.score,
    pnl: pt.pnl,
    event: pt.event_type,
  }));

  // Heatmap intensity helper
  const getHeatmapColor = (points: number, trades: number) => {
    if (trades === 0) return 'bg-slate-900 border-slate-800 text-slate-600';
    if (points === 0) return 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300';
    if (points <= 20) return 'bg-amber-950/60 border-amber-500/30 text-amber-300';
    if (points <= 45) return 'bg-orange-950/70 border-orange-500/40 text-orange-300';
    return 'bg-rose-950/80 border-rose-500/50 text-rose-300 font-bold';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Tilt Analytics & Behavioral Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical audit of emotional escalations, revenge trade detection, and active session patterns.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* 1. Tilt Score Timeline Chart */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Session Tilt Score Timeline
            </h2>
            <p className="text-xs text-slate-400">
              Score progression across trade events with threshold intervention lines
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal (0-30)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Nudge (31-60)
            </span>
            <span className="flex items-center gap-1 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Soft Lock (61-90)
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Kill Switch (90+)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          {timelineChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
              No timeline points recorded yet. Submit trades on the dashboard to populate telemetry.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineChartData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                {/* Threshold Reference Lines */}
                <ReferenceLine y={30} stroke="#10B981" strokeDasharray="3 3" opacity={0.6} />
                <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="3 3" opacity={0.6} />
                <ReferenceLine y={90} stroke="#EF4444" strokeWidth={1.5} opacity={0.8} />

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#F43F5E"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#F43F5E' }}
                  activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#F43F5E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2-Column: Rule Breakdown & Revenge History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Rule Breakdown (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Rule Trigger Frequency Breakdown
              </h2>
              <p className="text-xs text-slate-400">
                Distribution of which emotional & discipline rules were triggered
              </p>
            </div>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {data?.rule_breakdown.map((rule) => {
              const maxPoints = Math.max(1, ...data.rule_breakdown.map((r) => r.total_points));
              const pct = Math.min(100, Math.round((rule.total_points / maxPoints) * 100));

              return (
                <div key={rule.rule_name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{rule.display_name}</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {rule.count} hit{rule.count === 1 ? '' : 's'} • <strong className="text-white">{rule.total_points} pts</strong>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${rule.count === 0 ? 0 : Math.max(5, pct)}%`,
                        backgroundColor: rule.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Revenge Trade Detection History (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Revenge Trade Detections
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {data?.revenge_trades_history.length || 0} flagged
            </span>
          </div>

          <div className="overflow-y-auto space-y-2.5 max-h-80 pr-1 flex-1">
            {(!data?.revenge_trades_history || data.revenge_trades_history.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <AlertTriangle className="w-8 h-8 text-emerald-500/60 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Zero Revenge Re-entries</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  No instances of rapid re-entry (&lt;3 min) on the same ticker immediately after taking a loss. Excellent patience!
                </p>
              </div>
            ) : (
              data.revenge_trades_history.map((rev, idx) => (
                <div
                  key={rev.event_id || idx}
                  className="bg-orange-950/30 border border-orange-500/30 rounded-xl p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-orange-300 font-bold mb-1">
                    <span>{rev.instrument} Revenge Re-entry</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {rev.seconds_since_loss}s after loss
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Size: {rev.position_size} units</span>
                    <span className={rev.trade_pnl < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      PnL: {formatCurrency(rev.trade_pnl, { showSign: true })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Pattern Heatmap (Time of Day vs Tilt Score) */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Intraday Pattern Heatmap (24-Hour Velocity)
            </h2>
            <p className="text-xs text-slate-400">
              Identifies vulnerable hours of the day where tilt points and impulsive trades spike
            </p>
          </div>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>

        {/* 24-hour grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 text-center">
          {(data?.pattern_heatmap || []).map((h) => {
            const colorClass = getHeatmapColor(h.tilt_points, h.trade_count);
            return (
              <div
                key={h.hour}
                className={`rounded-xl p-2.5 border transition-all text-xs flex flex-col justify-between h-20 ${colorClass}`}
              >
                <span className="font-mono text-[10px] text-slate-400">{h.label}</span>
                <div className="font-mono text-sm font-bold">
                  {h.tilt_points > 0 ? `+${h.tilt_points}` : `${h.trade_count} tr`}
                </div>
                <span className="text-[9px] font-mono text-slate-400">
                  {h.trade_count} trades
                </span>
              </div>
            );
          })}
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center justify-end gap-3 mt-4 text-[11px] font-mono text-slate-400">
          <span className="text-slate-500">Severity:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-900 border border-slate-800" /> Idle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-950/60 border border-emerald-500/30" /> Clean
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-950/60 border border-amber-500/30" /> Low
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-orange-950/70 border border-orange-500/40" /> Medium
          </span>
          <span className="flex items-center gap-1 font-bold text-rose-400">
            <span className="w-2.5 h-2.5 rounded bg-rose-950/80 border border-rose-500/50" /> High Tilt
          </span>
        </div>
      </div>
    </div>
  );
};
