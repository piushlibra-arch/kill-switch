import React from 'react';
import { useTilt } from '../context/TiltContext';
import { AlertOctagon, Lock, Unlock, Clock, AlertTriangle } from 'lucide-react';

export const KillSwitchBanner: React.FC = () => {
  const { 
    status, 
    currentScore, 
    softLockActive, 
    softLockRemainingSeconds, 
    hardLockActive, 
    hardLockRemainingMinutes,
    setIsSoftLockModalOpen, 
    setIsHardLockModalOpen 
  } = useTilt();

  if (status === 'green') return null;

  if (status === 'yellow') {
    return (
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between text-amber-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-semibold text-sm text-amber-300">
              Emotional Velocity Nudge (Tilt Score: {currentScore})
            </span>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Warning threshold reached. Emotional volatility detected. Consider pausing 2 minutes before your next execution.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'orange' || softLockActive) {
    return (
      <div className="mb-6 rounded-xl border-2 border-orange-500/60 bg-gradient-to-r from-orange-950/80 via-orange-900/40 to-slate-900/80 p-4 shadow-lg shadow-orange-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0 animate-pulse">
            <Lock className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm uppercase tracking-wide text-orange-400">
                SOFT LOCK ENGAGED (Score: {currentScore})
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Mandatory 60s Wait or Confirmation
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {softLockRemainingSeconds > 0 ? (
                <>Cooldown active: <span className="font-mono font-bold text-orange-300">{softLockRemainingSeconds}s remaining</span>. Type <em>"I confirm this trade"</em> to execute immediately.</>
              ) : (
                <>Cooldown expired. Trader confirmation phrase required to unlock execution.</>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSoftLockModalOpen(true)}
          className="self-start sm:self-auto px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <Unlock className="w-3.5 h-3.5" />
          Confirm / Bypass Soft Lock
        </button>
      </div>
    );
  }

  if (status === 'red' || hardLockActive) {
    return (
      <div className="mb-6 rounded-xl border-2 border-rose-500 bg-gradient-to-r from-rose-950/90 via-rose-900/60 to-slate-950/90 p-4 sm:p-5 shadow-2xl shadow-rose-600/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse-fast">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/50">
            <AlertOctagon className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base uppercase tracking-wider text-white">
                HARD KILL SWITCH TRIGGERED (Score: {currentScore})
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500 text-white shadow">
                TRADING HALTED
              </span>
            </div>
            <p className="text-xs text-rose-200 mt-1 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 inline text-rose-300" />
              <span>Mandatory cooldown: ~{hardLockRemainingMinutes} min remaining. Placing trades is blocked by the intelligence layer.</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsHardLockModalOpen(true)}
          className="self-start sm:self-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-rose-950 font-bold rounded-lg text-xs shadow-xl transition-all flex items-center gap-2 shrink-0"
        >
          <Unlock className="w-4 h-4 text-rose-600" />
          Request Emergency Override
        </button>
      </div>
    );
  }

  return null;
};
