import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  BarChart3, 
  FileText, 
  Settings as SettingsIcon, 
  RotateCcw, 
  Play, 
  Square,
  Radio,
  Coins
} from 'lucide-react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentScore,
    status,
    sessionId,
    isWsConnected,
    setIsResetModalOpen,
    startNewSession,
    endCurrentSession,
  } = useTilt();
  const { currencySymbol, currencyCode, brokerName } = useCurrency();

  const getStatusBadge = () => {
    switch (status) {
      case 'green':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          label: 'OPTIMAL (GREEN)',
        };
      case 'yellow':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500',
          label: 'WARNING (YELLOW)',
        };
      case 'orange':
        return {
          bg: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
          dot: 'bg-orange-500 animate-ping',
          label: 'SOFT LOCK (ORANGE)',
        };
      case 'red':
        return {
          bg: 'bg-rose-500/25 border-rose-500/50 text-rose-300 font-bold',
          dot: 'bg-rose-500 animate-ping',
          label: 'KILL SWITCH (RED)',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AegisTilt
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
                Intelligence Layer
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>Sess: {sessionId ? sessionId.slice(0, 18) : 'active'}</span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[10px] text-slate-500">{isWsConnected ? 'LIVE WS' : 'OFFLINE'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'review'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            Session Review
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <SettingsIcon className="w-4 h-4 text-slate-400" />
            Settings
          </button>
        </nav>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Active Broker & Currency Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-white uppercase">{brokerName}</span>
            <span className="text-amber-300 font-bold bg-amber-500/10 px-1 rounded">{currencySymbol} {currencyCode}</span>
          </div>

          {/* Live Tilt Status Pill */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span>{badge.label}</span>
            <span className="font-bold text-white pl-1 border-l border-slate-700/50">
              {currentScore}/100
            </span>
          </div>

          {/* Quick Actions */}
          <button
            onClick={() => setIsResetModalOpen(true)}
            title="Manual Score Reset (Logged)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Reset Score</span>
          </button>

          <button
            onClick={() => startNewSession('Trader started new session')}
            title="Start New Trading Session (Clears tilt)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-all"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Mobile nav tabs */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-1.5 bg-[#0A0D15]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded ${
            activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded ${
            activeTab === 'analytics' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded ${
            activeTab === 'review' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          Review
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded ${
            activeTab === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </header>
  );
};
