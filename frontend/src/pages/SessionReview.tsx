import React, { useState, useEffect } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../api/client';
import { SessionSummary } from '../types';
import { 
  FileText, 
  Flame, 
  DollarSign, 
  Lightbulb, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCw,
  AlertCircle,
  Square
} from 'lucide-react';

export const SessionReview: React.FC = () => {
  const { traderId, endCurrentSession } = useTilt();
  const { formatCurrency } = useCurrency();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [endingSession, setEndingSession] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      // Fetch current session first
      const sess = await api.getCurrentSession(traderId);
      if (sess && sess.session_id) {
        const s = await api.getSessionSummary(sess.session_id);
        setSummary(s);
      }
    } catch (err) {
      console.error('Failed to load session review', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [traderId]);

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      const res = await endCurrentSession('Trader formally concluded session and initiated audit review.');
      setSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setEndingSession(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
        <p className="text-sm font-mono">Synthesizing Post-Session Audit...</p>
      </div>
    );
  }

  const isProfitable = (summary?.total_pnl || 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Post-Session Review & Tilt Audit
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Session ID: <span className="font-mono text-slate-200">{summary?.session_id}</span> • Status:{' '}
            <span className={`font-semibold ${summary?.is_active ? 'text-emerald-400' : 'text-slate-400'}`}>
              {summary?.is_active ? 'ACTIVE' : 'CONCLUDED'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {summary?.is_active && (
            <button
              onClick={handleEndSession}
              disabled={endingSession}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
            >
              <Square className="w-3.5 h-3.5" />
              {endingSession ? 'Closing...' : 'Close & Finalize Session'}
            </button>
          )}

          <button
            onClick={loadSummary}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net PnL */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <span className="text-[11px] font-mono uppercase text-slate-400">Total Session PnL</span>
          <div className={`text-2xl font-black font-mono mt-1 ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(summary?.total_pnl || 0, { showSign: true })}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {summary?.winning_trades} wins / {summary?.losing_trades} losses ({Math.round((summary?.win_rate || 0) * 100)}% Win Rate)
          </span>
        </div>

        {/* Revenge PnL Lost */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <span className="text-[11px] font-mono uppercase text-rose-300">PnL Lost to Revenge Trades</span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {formatCurrency(summary?.estimated_revenge_pnl_loss || 0)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Directly preventable emotional capital draw
          </span>
        </div>

        {/* Emotional Trades Flagged */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <span className="text-[11px] font-mono uppercase text-orange-300">Emotional Trades Flagged</span>
          <div className="text-2xl font-black font-mono text-orange-400 mt-1">
            {summary?.emotional_trades.length || 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {summary?.revenge_trades_count || 0} rapid revenge re-entries
          </span>
        </div>

        {/* Peak Tilt Index */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <span className="text-[11px] font-mono uppercase text-slate-400">Peak Tilt Score</span>
          <div className={`text-2xl font-black font-mono mt-1 ${
            (summary?.peak_tilt_score || 0) > 90 ? 'text-rose-500' : (summary?.peak_tilt_score || 0) > 60 ? 'text-orange-400' : 'text-emerald-400'
          }`}>
            {summary?.peak_tilt_score || 0} / 100
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {(summary?.peak_tilt_score || 0) > 90 ? 'Kill Switch Triggered' : 'Maintained Control'}
          </span>
        </div>
      </div>

      {/* Actionable Improvement Suggestions */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Psychological & Tactical Coaching Directives
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {(summary?.suggestions || []).map((sug, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
                {i + 1}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sug}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Flagged Emotional Trades Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Flagged Emotional Trades
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {summary?.emotional_trades.length || 0} flagged anomalies
          </span>
        </div>

        {(!summary?.emotional_trades || summary.emotional_trades.length === 0) ? (
          <div className="py-8 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">Clean Session Executed</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              No executions breached emotional guardrails or revenge re-entry rules.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Trade ID</th>
                  <th className="py-2.5 px-3">Ticker</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Position Size</th>
                  <th className="py-2.5 px-3">PnL</th>
                  <th className="py-2.5 px-3">Triggered Behavioral Rules</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {summary.emotional_trades.map((t) => (
                  <tr key={t.trade_id} className="hover:bg-slate-850 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">#{t.trade_id}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{t.instrument}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.trade_type === 'long' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                      }`}>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{t.position_size}</td>
                    <td className={`py-2.5 px-3 font-bold ${
                      t.pnl > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrency(t.pnl, { showSign: true })}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {t.triggered_rules.map((r, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
