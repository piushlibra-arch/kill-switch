import React, { useState } from 'react';
import { useTilt } from '../context/TiltContext';
import { AlertOctagon, X, KeyRound, ShieldAlert } from 'lucide-react';

export const HardLockModal: React.FC = () => {
  const {
    isHardLockModalOpen,
    setIsHardLockModalOpen,
    hardLockRemainingMinutes,
    currentScore,
    overrideLock,
  } = useTilt();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isHardLockModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 8) {
      setErrorMsg('Please enter a substantive explanation (at least 8 characters).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await overrideLock(reason.trim());
      setReason('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-rose-500 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-rose-600/30 text-slate-100">
        {/* Close button */}
        <button
          onClick={() => setIsHardLockModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-600/40">
            <AlertOctagon className="w-8 h-8 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                CRITICAL THRESHOLD (90+)
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight mt-1">
              Hard Kill Switch Activated
            </h3>
            <p className="text-xs text-rose-300/80 mt-1">
              Tilt Score reached {currentScore}. Session is locked to protect your capital from severe revenge spiral.
            </p>
          </div>
        </div>

        {/* Cooldown Info Banner */}
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between text-xs font-mono text-rose-200">
            <span>Mandatory Cooldown Required:</span>
            <span className="font-bold text-white text-sm">~{hardLockRemainingMinutes} minutes</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Standard operating procedure: Step away from trading screens, walk outside, hydrate, and do not look at intraday PnL.
          </p>
        </div>

        {/* Override Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Emergency Override Reason (Immutably Logged)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State your technical thesis, risk management review, and confirmation that emotion is not driving this trade..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Overrides are recorded permanently in post-session audit logs for performance review.
            </span>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsHardLockModalOpen(false)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Respect Cooldown
            </button>

            <button
              type="submit"
              disabled={reason.trim().length < 8 || submitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                reason.trim().length >= 8 && !submitting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              {submitting ? 'Applying Override...' : 'Confirm Override & Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
