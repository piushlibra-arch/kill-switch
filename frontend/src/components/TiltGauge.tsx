import React from 'react';
import { useTilt } from '../context/TiltContext';
import { ShieldCheck, AlertTriangle, Lock, Flame } from 'lucide-react';

export const TiltGauge: React.FC = () => {
  const { currentScore, status } = useTilt();

  // Score 0-100 mapped to angle -90 to +90 degrees (180 deg sweep)
  const clampedScore = Math.min(100, Math.max(0, currentScore));
  const angle = -90 + (clampedScore / 100) * 180;

  const getStatusInfo = () => {
    switch (status) {
      case 'green':
        return {
          title: 'CALM & OBJECTIVE',
          subtitle: 'Execution strictly adheres to trader baseline guardrails.',
          badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          shadow: 'shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)]',
          needleColor: '#10B981',
        };
      case 'yellow':
        return {
          title: 'ELEVATED EMOTIONAL TENSION',
          subtitle: 'Loss or frequency spikes detected. Slow down execution speed.',
          badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          shadow: 'shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]',
          needleColor: '#F59E0B',
        };
      case 'orange':
        return {
          title: 'SOFT LOCK THRESHOLD ENGAGED',
          subtitle: 'Revenge or size escalation tendencies active. 60s cooldown enforced.',
          badgeColor: 'text-orange-400 border-orange-500/40 bg-orange-500/20',
          icon: <Lock className="w-5 h-5 text-orange-400 animate-bounce" />,
          shadow: 'shadow-[0_0_50px_-10px_rgba(249,115,22,0.4)]',
          needleColor: '#F97316',
        };
      case 'red':
        return {
          title: 'KILL SWITCH ACTIVATED — HARD LOCK',
          subtitle: 'Severe tilt detected. Trading locked for 30 minutes minimum.',
          badgeColor: 'text-rose-400 border-rose-500/50 bg-rose-500/20',
          icon: <Flame className="w-5 h-5 text-rose-500 animate-pulse" />,
          shadow: 'shadow-[0_0_60px_-5px_rgba(239,68,68,0.5)]',
          needleColor: '#EF4444',
        };
    }
  };

  const info = getStatusInfo();

  // SVG Gauge geometry (radius = 110, center = 150, 150)
  // 180 deg arc: 0 to 100
  // Green: 0 to 30% (54 deg)
  // Yellow: 30 to 60% (54 deg)
  // Orange: 60 to 90% (54 deg)
  // Red: 90 to 100% (18 deg)
  const radius = 105;
  const strokeWidth = 18;
  const circumference = Math.PI * radius; // half circle circumference

  // Arc lengths
  const greenLen = circumference * 0.30;
  const yellowLen = circumference * 0.30;
  const orangeLen = circumference * 0.30;
  const redLen = circumference * 0.10;

  return (
    <div className={`relative glass-panel rounded-2xl p-6 flex flex-col items-center justify-between border border-slate-800 transition-all duration-500 ${info.shadow}`}>
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping-slow" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Real-Time Tilt Score
          </h2>
        </div>
        <div className={`px-2.5 py-1 rounded-full border text-xs font-mono font-medium flex items-center gap-1.5 ${info.badgeColor}`}>
          {info.icon}
          <span>{status.toUpperCase()} ZONE</span>
        </div>
      </div>

      {/* Radial Gauge SVG */}
      <div className="relative w-72 h-44 flex items-center justify-center my-1">
        <svg viewBox="0 0 300 180" className="w-full h-full overflow-visible">
          <defs>
            {/* Gradients for smooth zone aesthetics */}
            <linearGradient id="gaugeBg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            <linearGradient id="needleGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={info.needleColor} />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>

            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track */}
          <path
            d="M 40 150 A 110 110 0 0 1 260 150"
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Green Zone (0-30%) */}
          <path
            d="M 40 150 A 110 110 0 0 1 260 150"
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${greenLen} ${circumference}`}
            strokeDashoffset="0"
            className="transition-all duration-300"
          />

          {/* Yellow Zone (30-60%) */}
          <path
            d="M 40 150 A 110 110 0 0 1 260 150"
            fill="none"
            stroke="#F59E0B"
            strokeWidth={strokeWidth}
            strokeDasharray={`${yellowLen} ${circumference}`}
            strokeDashoffset={`-${greenLen}`}
            className="transition-all duration-300"
          />

          {/* Orange Zone (60-90%) */}
          <path
            d="M 40 150 A 110 110 0 0 1 260 150"
            fill="none"
            stroke="#F97316"
            strokeWidth={strokeWidth}
            strokeDasharray={`${orangeLen} ${circumference}`}
            strokeDashoffset={`-${greenLen + yellowLen}`}
            className="transition-all duration-300"
          />

          {/* Red Zone (90-100%) */}
          <path
            d="M 40 150 A 110 110 0 0 1 260 150"
            fill="none"
            stroke="#EF4444"
            strokeWidth={strokeWidth}
            strokeDasharray={`${redLen} ${circumference}`}
            strokeDashoffset={`-${greenLen + yellowLen + orangeLen}`}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Ticks and boundary labels */}
          <text x="32" y="172" className="text-[11px] fill-slate-400 font-mono font-medium">0</text>
          <text x="85" y="65" className="text-[10px] fill-slate-400 font-mono">30</text>
          <text x="145" y="30" className="text-[10px] fill-slate-400 font-mono">60</text>
          <text x="210" y="65" className="text-[10px] fill-slate-400 font-mono">90</text>
          <text x="256" y="172" className="text-[11px] fill-rose-400 font-mono font-medium">100</text>

          {/* Rotating Needle */}
          <g
            transform={`translate(150, 150) rotate(${angle})`}
            className="transition-transform duration-700 ease-out"
          >
            {/* Needle line */}
            <line
              x1="0"
              y1="0"
              x2="-95"
              y2="0"
              stroke={info.needleColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#gaugeGlow)"
            />
            {/* Center hub */}
            <circle cx="0" cy="0" r="10" fill="#0F172A" stroke={info.needleColor} strokeWidth="3" />
            <circle cx="0" cy="0" r="4" fill="#FFFFFF" />
          </g>
        </svg>

        {/* Large Score Display in Center Bottom */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {currentScore}
          </span>
          <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
            TILT INDEX
          </span>
        </div>
      </div>

      {/* Threshold Progress Bar & Explanations */}
      <div className="w-full mt-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
          <span className="font-semibold text-slate-200">{info.title}</span>
          <span className="text-slate-400">{currentScore} / 100 pts</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {info.subtitle}
        </p>

        {/* Zones legend */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-800/50 text-[10px] font-mono text-center">
          <div className="py-1 px-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            0-30 Calm
          </div>
          <div className="py-1 px-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
            31-60 Nudge
          </div>
          <div className="py-1 px-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-300 font-semibold">
            61-90 Soft Lock
          </div>
          <div className="py-1 px-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
            90+ KILL SWITCH
          </div>
        </div>
      </div>
    </div>
  );
};
