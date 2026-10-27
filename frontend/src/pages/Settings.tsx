import React, { useState, useEffect } from 'react';
import { useTilt } from '../context/TiltContext';
import { api } from '../api/client';
import { Settings as SettingsIcon, Save, RotateCw, Bell, Shield, Sliders } from 'lucide-react';
import { BrokerIntegrationCard } from '../components/BrokerIntegrationCard';

export const Settings: React.FC = () => {
  const { traderId, baseline, updateBaselineSettings } = useTilt();

  const [activeHours, setActiveHours] = useState('09:30-16:00');
  const [avgPositionSize, setAvgPositionSize] = useState('100');
  const [avgTradesPerHour, setAvgTradesPerHour] = useState('3.0');
  const [hardLockCooldown, setHardLockCooldown] = useState('30');
  const [softLockCooldown, setSoftLockCooldown] = useState('60');
  const [notifyWarnings, setNotifyWarnings] = useState(true);
  const [notifySoftLock, setNotifySoftLock] = useState(true);
  const [notifyHardLock, setNotifyHardLock] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (baseline) {
      setActiveHours(baseline.active_session_hours || '09:30-16:00');
      setAvgPositionSize(baseline.avg_position_size?.toString() || '100');
      setAvgTradesPerHour(baseline.avg_trades_per_hour?.toString() || '3.0');
      setHardLockCooldown(baseline.hard_lock_cooldown_minutes?.toString() || '30');
      setSoftLockCooldown(baseline.soft_lock_cooldown_seconds?.toString() || '60');
    }
  }, [baseline]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateBaselineSettings({
        active_session_hours: activeHours,
        avg_position_size: parseFloat(avgPositionSize) || 100,
        avg_trades_per_hour: parseFloat(avgTradesPerHour) || 3.0,
        hard_lock_cooldown_minutes: parseInt(hardLockCooldown) || 30,
        soft_lock_cooldown_seconds: parseInt(softLockCooldown) || 60,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await api.recalculateBaseline(traderId);
      setActiveHours(res.active_session_hours);
      setAvgPositionSize(res.avg_position_size.toString());
      setAvgTradesPerHour(res.avg_trades_per_hour.toString());
    } catch (err) {
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-400" />
            Risk Baseline & Intervention Parameters
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure trader baseline limits, session active hours, and kill switch cooldown thresholds.
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all"
        >
          <RotateCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Recalculating...' : 'Recalculate 24h Baseline'}
        </button>
      </div>

      {/* Unified Broker Integration Layer Card */}
      <BrokerIntegrationCard />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Baseline Guardrails Card */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Trader Baseline Guardrails
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Active Session Hours (HH:MM-HH:MM)
              </label>
              <input
                type="text"
                value={activeHours}
                onChange={(e) => setActiveHours(e.target.value)}
                placeholder="09:30-16:00"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Trades executed outside this window trigger OUTSIDE_SESSION (+25 pts).
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Standard Average Position Size (Contracts/Units)
              </label>
              <input
                type="number"
                step="any"
                value={avgPositionSize}
                onChange={(e) => setAvgPositionSize(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Trades &gt;1.5x after loss trigger SIZE_ESCALATION (+20 pts).
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Average Hourly Execution Frequency
              </label>
              <input
                type="number"
                step="any"
                value={avgTradesPerHour}
                onChange={(e) => setAvgTradesPerHour(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Executing &gt;2x hourly baseline triggers FREQUENCY_SPIKE (+15 pts).
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Preferred Instruments
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(baseline?.preferred_instruments || ['NQ', 'ES', 'AAPL', 'NVDA', 'TSLA']).map((inst) => (
                  <span
                    key={inst}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-xs font-bold"
                  >
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Intervention Cooldowns Card */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
            <Shield className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Intervention System Cooldown Durations
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Hard Kill Switch Cooldown (Minutes)
              </label>
              <input
                type="number"
                value={hardLockCooldown}
                onChange={(e) => setHardLockCooldown(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 30 minutes. Triggered when tilt score reaches 90+.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Soft Lock Delay Timer (Seconds)
              </label>
              <input
                type="number"
                value={softLockCooldown}
                onChange={(e) => setSoftLockCooldown(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 60 seconds. Friction delay triggered at 61–90 pts.
              </span>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Real-Time Push Alerts & Nudges
            </h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Yellow Zone Velocity Warning (31–60 pts)</span>
              <input
                type="checkbox"
                checked={notifyWarnings}
                onChange={(e) => setNotifyWarnings(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Orange Zone Soft Lock Screen Freeze (61–90 pts)</span>
              <input
                type="checkbox"
                checked={notifySoftLock}
                onChange={(e) => setNotifySoftLock(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Red Zone Emergency Kill Switch Audio & Modal (90+ pts)</span>
              <input
                type="checkbox"
                checked={notifyHardLock}
                onChange={(e) => setNotifyHardLock(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
              />
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
