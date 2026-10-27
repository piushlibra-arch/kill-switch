import React, { useState } from 'react';
import { useTilt } from '../context/TiltContext';
import { Lock, X, CheckCircle2, FastForward } from 'lucide-react';

export const SoftLockModal: React.FC = () => {
  const {
    isSoftLockModalOpen,
    setIsSoftLockModalOpen,
    softLockRemainingSeconds,
    confirmSoftLock,
  } = useTilt();

  const [inputPhrase, setInputPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isSoftLockModalOpen) return null;

  const targetPhrase = 'I confirm this trade';
  const isMatch = inputPhrase.trim().toLowerCase() === targetPhrase.toLowerCase();
  const canProceed = isMatch || softLockRemainingSeconds <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      await confirmSoftLock(inputPhrase.trim() || targetPhrase);
      setInputPhrase('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to acknowledge soft lock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-orange-500/50 rounded-2xl p-6 shadow-2xl shadow-orange-500/20 text-slate-100">
        {/* Close button */}
        <button
          onClick={() => setIsSoftLockModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Soft Lock Friction Check
            </h3>
            <span className="text-xs font-mono text-orange-400 font-medium">
              Tilt Score Zone: 61–90 (Orange)
            </span>
          </div>
        </div>

        {/* Cooldown Timer */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 mb-5 text-center">
          <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
            Mandatory Cooldown Countdown
          </span>
          <div className="text-4xl font-black font-mono text-orange-400">
            00:{softLockRemainingSeconds < 10 ? `0${softLockRemainingSeconds}` : softLockRemainingSeconds}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {softLockRemainingSeconds > 0
              ? 'Take 3 deep breaths. Allow elevated heart rate to normalize.'
              : '✅ Cooldown timer completed!'}
          </span>
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              To bypass timer, type exactly: <strong className="text-orange-400 font-mono">"{targetPhrase}"</strong>
            </label>
            <input
              type="text"
              value={inputPhrase}
              onChange={(e) => setInputPhrase(e.target.value)}
              placeholder="I confirm this trade"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!canProceed || submitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                canProceed
                  ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Confirming...' : 'Acknowledge & Continue'}
            </button>

            {/* Quick Fast Forward (helpful for interactive demos) */}
            <button
              type="button"
              onClick={() => setInputPhrase(targetPhrase)}
              title="Demo autofill confirmation phrase"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs flex items-center gap-1 font-mono"
            >
              <FastForward className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
