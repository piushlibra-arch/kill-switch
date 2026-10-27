import React, { useState } from 'react';
import { TiltProvider, useTilt } from './context/TiltContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { SessionReview } from './pages/SessionReview';
import { Settings } from './pages/Settings';
import { SoftLockModal } from './components/SoftLockModal';
import { HardLockModal } from './components/HardLockModal';
import { ResetModal } from './components/ResetModal';
import { X, CheckCircle, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useTilt();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const getToastStyle = () => {
          switch (t.type) {
            case 'success':
              return {
                bg: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200',
                icon: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
              };
            case 'warning':
              return {
                bg: 'bg-amber-950/95 border-amber-500/40 text-amber-200',
                icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
              };
            case 'error':
              return {
                bg: 'bg-rose-950/95 border-rose-500/50 text-rose-200',
                icon: <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />,
              };
            default:
              return {
                bg: 'bg-slate-900/95 border-slate-700 text-slate-200',
                icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
              };
          }
        };

        const style = getToastStyle();

        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl p-3 border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 transition-all animate-slide-in ${style.bg}`}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{style.icon}</div>
              <div>
                <span className="text-xs font-bold block">{t.title}</span>
                <span className="text-[11px] opacity-90 leading-tight block mt-0.5">{t.message}</span>
              </div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'review' | 'settings'>('dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-[#070A10] text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar activeTab={activeTab} setActiveTab={(tab: any) => setActiveTab(tab)} />

      <main className="flex-1 pb-12">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'review' && <SessionReview />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Modals */}
      <SoftLockModal />
      <HardLockModal />
      <ResetModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <TiltProvider>
      <CurrencyProvider>
        <MainContent />
      </CurrencyProvider>
    </TiltProvider>
  );
}
