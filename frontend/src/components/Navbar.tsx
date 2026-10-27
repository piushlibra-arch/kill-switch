import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  BarChart3, 
  FileText, 
  Settings as SettingsIcon, 
  RotateCcw, 
  Play, 
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
  } = useTilt();
  const { currencySymbol, currencyCode, brokerName } = useCurrency();

  const getStatusBadge = () => {
    switch (status) {
      case 'green':
        return {
          bg: 'bg-[#00d084]/10 border-[#00d084]/30 text-[#00d084]',
          dot: 'bg-[#00d084]',
          label: 'OPTIMAL (GREEN)',
        };
      case 'yellow':
        return {
          bg: 'bg-[#ffd700]/10 border-[#ffd700]/30 text-[#ffd700]',
          dot: 'bg-[#ffd700]',
          label: 'WARNING (YELLOW)',
        };
      case 'orange':
        return {
          bg: 'bg-[#ff6600]/15 border-[#ff6600]/40 text-[#ff6600]',
          dot: 'bg-[#ff6600] animate-ping',
          label: 'SOFT LOCK (ORANGE)',
        };
      case 'red':
        return {
          bg: 'bg-[#ff3b3b]/20 border-[#ff3b3b]/50 text-[#ff3b3b] font-bold',
          dot: 'bg-[#ff3b3b] animate-ping',
          label: 'KILL SWITCH (RED)',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="border-b border-[#1e2530] bg-[#0a0c10]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff6600] to-[#b34700] flex items-center justify-center shadow-lg shadow-[#ff6600]/20 border border-[#ff6600]/40">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white font-mono">
                AEGIS<span className="text-[#ff6600]">TILT</span>
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-[#ff6600]/10 border border-[#ff6600]/30 text-[#ff6600] font-semibold">
                BLOOMBERG 2.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>SESS: {sessionId ? sessionId.slice(0, 16) : 'ACTIVE'}</span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-[#00d084]' : 'bg-[#ff3b3b]'}`} />
                <span className="text-[10px] text-slate-400 font-bold">{isWsConnected ? 'FEED LIVE' : 'WS DISCONNECTED'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#0f1218] p-1 rounded-lg border border-[#1e2530]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#141820] text-[#ff6600] shadow-sm border border-[#ff6600]/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#141820]/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#ff6600]" />
            TERMINAL
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-[#141820] text-[#ff6600] shadow-sm border border-[#ff6600]/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#141820]/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#ffd700]" />
            ANALYTICS
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'review'
                ? 'bg-[#141820] text-[#ff6600] shadow-sm border border-[#ff6600]/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#141820]/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#00d084]" />
            SESSION REVIEW
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-[#141820] text-[#ff6600] shadow-sm border border-[#ff6600]/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#141820]/60'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            CONFIG & BASELINE
          </button>
        </nav>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Active Broker & Dynamic Currency Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0f1218] border border-[#1e2530] text-xs font-mono text-slate-300">
            <Coins className="w-3.5 h-3.5 text-[#ff6600]" />
            <span className="font-bold text-white uppercase">{brokerName}</span>
            <span className="text-[#ff6600] font-bold bg-[#ff6600]/10 px-1 rounded border border-[#ff6600]/20">
              {currencySymbol} {currencyCode}
            </span>
          </div>

          {/* Live Tilt Status Pill */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-mono transition-all ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span>{badge.label}</span>
            <span className="font-bold text-white pl-1.5 border-l border-white/20">
              {currentScore}/100
            </span>
          </div>

          {/* Quick Actions */}
          <button
            onClick={() => setIsResetModalOpen(true)}
            title="Manual Score Reset (Logged)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0f1218] hover:bg-[#141820] text-slate-300 hover:text-white rounded-md border border-[#1e2530] text-xs font-mono transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#ff6600]" />
            <span className="hidden lg:inline">RESET</span>
          </button>

          <button
            onClick={() => startNewSession('Trader started new session')}
            title="Start New Trading Session (Clears tilt)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#00d084]/15 hover:bg-[#00d084]/25 text-[#00d084] border border-[#00d084]/30 rounded-md text-xs font-mono transition-all"
          >
            <Play className="w-3.5 h-3.5 text-[#00d084]" />
            <span className="hidden lg:inline">NEW SESS</span>
          </button>
        </div>
      </div>

      {/* Mobile nav tabs */}
      <div className="md:hidden flex items-center justify-around border-t border-[#1e2530] px-2 py-1.5 bg-[#0a0c10]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded ${
            activeTab === 'dashboard' ? 'bg-[#141820] text-[#ff6600] border border-[#ff6600]/30' : 'text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#ff6600]" />
          Terminal
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded ${
            activeTab === 'analytics' ? 'bg-[#141820] text-[#ffd700] border border-[#ffd700]/30' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#ffd700]" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded ${
            activeTab === 'review' ? 'bg-[#141820] text-[#00d084] border border-[#00d084]/30' : 'text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-[#00d084]" />
          Review
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded ${
            activeTab === 'settings' ? 'bg-[#141820] text-slate-200 border border-slate-700' : 'text-slate-400'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Config
        </button>
      </div>
    </header>
  );
};
