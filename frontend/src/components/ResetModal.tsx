import React, { useState } from 'react';
import { useTilt } from '../context/TiltContext';
import { RotateCcw, X, CheckCircle } from 'lucide-react';

export const ResetModal: React.FC = () => {
  const {
    isResetModalOpen,
    setIsResetModalOpen,
    currentScore,
    resetScore,
  } = useTilt();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isResetModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setErrorMsg('Please specify a brief reset justification.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await resetScore(reason.trim());
      setReason('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100">
        <button
          onClick={() => setIsResetModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Manual Tilt Score Reset
            </h3>
            <span className="text-xs text-slate-400">
              Current score: <strong className="text-white">{currentScore} pts</strong>
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Resetting restores your tilt score back to 0 (Green). All manual resets are recorded with timestamp and reason in the audit ledger.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reset Justification / Cooldown Note
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Completed 20-min cooldown walk and reviewed playbook."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 3 || submitting}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                reason.trim().length >= 3 && !submitting
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Resetting...' : 'Confirm Reset (0 pts)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
