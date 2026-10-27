import React from 'react';
import { KillSwitchBanner } from '../components/KillSwitchBanner';
import { ActiveSessionStats } from '../components/ActiveSessionStats';
import { RiskMetricsPanel } from '../components/RiskMetricsPanel';
import { BrokerStatusPanel } from '../components/BrokerStatusPanel';
import { TiltGauge } from '../components/TiltGauge';
import { PnLChart } from '../components/PnLChart';
import { TradeForm } from '../components/TradeForm';
import { TiltEventFeed } from '../components/TiltEventFeed';
import { TradeHistoryTable } from '../components/TradeHistoryTable';

export const Dashboard: React.FC = () => {
  return (
    <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-8 py-5 space-y-5">
      {/* Dynamic Kill Switch Banner (when Yellow/Orange/Red) */}
      <KillSwitchBanner />

      {/* Bloomberg Terminal Stat Cards: Net P&L, Max DD, Risk/Reward, Streak Counter, Time in Market */}
      <ActiveSessionStats />

      {/* Bloomberg 2.0 3-Column Layout:
          Desktop: Left sidebar stats | Center gauge + chart | Right trigger feed
          Mobile: Stacked single column
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (3 cols): Risk Metrics Budget + Broker Connectivity Matrix */}
        <div className="lg:col-span-3 space-y-5 flex flex-col">
          <RiskMetricsPanel />
          <BrokerStatusPanel />
        </div>

        {/* Center Column (6 cols): Real-Time Tilt Gauge + Cumulative Session PnL Chart + Trade Entry Form */}
        <div className="lg:col-span-6 space-y-5 flex flex-col">
          <TiltGauge />
          <PnLChart />
          <TradeForm />
        </div>

        {/* Right Column (3 cols): Real-Time Behavioral Tilt Trigger Feed */}
        <div className="lg:col-span-3 space-y-5 flex flex-col">
          <TiltEventFeed />
        </div>
      </div>

      {/* Below: Full-width Trade History Table with Sticky Columns on Mobile & Flag Icons */}
      <div className="w-full pt-1">
        <TradeHistoryTable />
      </div>
    </div>
  );
};
