import React, { useState, useEffect } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../api/client';
import { BrokerConfigItem, BrokerOrder } from '../types';
import { 
  Building2, 
  Wifi, 
  WifiOff, 
  Clock, 
  Layers, 
  Coins, 
  CheckCircle2, 
  XCircle, 
  RefreshCw 
} from 'lucide-react';

interface BrokerMetaEntry {
  key: string;
  displayName: string;
  country: 'IN' | 'US' | 'GLOBAL';
  type: string;
}

const BROKER_LIST: BrokerMetaEntry[] = [
  { key: 'dhan', displayName: 'Dhan HQ', country: 'IN', type: 'Primary F&O' },
  { key: 'zerodha', displayName: 'Zerodha Kite', country: 'IN', type: 'KiteConnect' },
  { key: 'upstox', displayName: 'Upstox Pro', country: 'IN', type: 'OAuth2 v2' },
  { key: 'fyers', displayName: 'Fyers API', country: 'IN', type: 'DataSocket' },
  { key: 'angelone', displayName: 'Angel SmartAPI', country: 'IN', type: 'TOTP 2FA' },
  { key: 'breeze', displayName: 'ICICI Breeze', country: 'IN', type: 'Secured API' },
  { key: 'alpaca', displayName: 'Alpaca US ($)', country: 'US', type: 'Equities' },
  { key: 'binance', displayName: 'Binance (USDT)', country: 'GLOBAL', type: 'Perpetuals' },
];

export const BrokerStatusPanel: React.FC = () => {
  const { traderId, isWsConnected, addToast } = useTilt();
  const { currencySymbol, brokerName, formatCurrency, refreshCurrencyConfig } = useCurrency();

  const [configs, setConfigs] = useState<BrokerConfigItem[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string>('Live');

  const fetchBrokerTelemetry = async () => {
    setLoading(true);
    try {
      const [cfgs, ords] = await Promise.all([
        api.getBrokerConfigs(traderId),
        api.getBrokerOrders(traderId).catch(() => []),
      ]);
      setConfigs(cfgs || []);
      setOrders(ords || []);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Telemetry poll:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokerTelemetry();
    const interval = setInterval(fetchBrokerTelemetry, 30000);
    return () => clearInterval(interval);
  }, [traderId]);

  // Find active broker configuration
  const activeConfig = configs.find((c) => c.is_active) || {
    broker_name: brokerName || 'dhan',
    is_active: true,
    is_sandbox: false,
    client_id_masked: '1101••••••••7061',
  };

  const activeBrokerMeta =
    BROKER_LIST.find((b) => b.key === (activeConfig.broker_name || brokerName)) ||
    BROKER_LIST[0];

  const handleSyncNow = async () => {
    try {
      await api.syncBrokerNow(traderId);
      await fetchBrokerTelemetry();
      await refreshCurrencyConfig();
      addToast({
        type: 'success',
        title: 'Broker Telemetry Synced',
        message: `Active gateway ${activeBrokerMeta.displayName} synced with exchange.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: err.message || 'Error syncing broker orders',
      });
    }
  };

  return (
    <div className="bb-card rounded-xl p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1e2530] mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#ff6600]" />
          <div>
            <h3 className="bb-header text-xs tracking-wider">
              Broker Gateways // Telemetry
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Active Gateway & Multi-Broker Connectivity
            </span>
          </div>
        </div>

        <button
          onClick={handleSyncNow}
          disabled={loading}
          title="Force Sync Gateway"
          className="p-1 rounded bg-[#141820] hover:bg-[#1e2530] border border-[#1e2530] text-slate-300 hover:text-white transition-all text-xs font-mono flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 text-[#ff6600] ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline text-[10px]">SYNC</span>
        </button>
      </div>

      {/* Primary Active Broker Hero Card */}
      <div className="bg-[#141820] rounded-lg p-3.5 border border-[#2a3545] mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00d084] animate-pulse" />
            <span className="text-xs font-bold font-mono text-white tracking-wide uppercase">
              {activeBrokerMeta.displayName}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00d084]/15 text-[#00d084] border border-[#00d084]/30">
              ACTIVE
            </span>
            {activeConfig.is_sandbox ? (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#ffd700]/15 text-[#ffd700] border border-[#ffd700]/30">
                SANDBOX
              </span>
            ) : (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00d084]/20 text-[#00d084] font-bold">
                LIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono">
            {isWsConnected ? (
              <span className="text-[#00d084] flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                <span>FEED ON</span>
              </span>
            ) : (
              <span className="text-[#ff3b3b] flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span>POLLING</span>
              </span>
            )}
          </div>
        </div>

        {/* 3 Metric Mini Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e2530] font-mono text-xs">
          <div>
            <span className="text-[9px] text-[#ff6600] uppercase block">Currency</span>
            <span className="font-bold text-white text-xs">{currencySymbol} ({activeBrokerMeta.country})</span>
          </div>
          <div>
            <span className="text-[9px] text-[#ff6600] uppercase block">Orders Today</span>
            <span className="font-bold text-white text-xs">{orders.length}</span>
          </div>
          <div>
            <span className="text-[9px] text-[#ff6600] uppercase block">Last Sync</span>
            <span className="text-slate-300 text-[11px] truncate block">{lastSync}</span>
          </div>
        </div>
      </div>

      {/* Grid of All 8 Brokers */}
      <div>
        <span className="bb-label text-[10px] block mb-2">
          Broker Adapter Matrix
        </span>
        <div className="grid grid-cols-2 gap-2 font-mono">
          {BROKER_LIST.map((b) => {
            const isThisActive = b.key === (activeConfig.broker_name || brokerName);
            const savedCfg = configs.find((c) => c.broker_name === b.key);
            const isConfigured = Boolean(savedCfg);

            return (
              <div
                key={b.key}
                className={`p-2 rounded border text-left transition-all flex items-center justify-between ${
                  isThisActive
                    ? 'bg-[#141820] border-[#ff6600]/60 shadow-sm shadow-[#ff6600]/10'
                    : isConfigured
                    ? 'bg-[#0f1218] border-[#1e2530] hover:border-[#2a3545]'
                    : 'bg-[#0a0c10] border-[#1e2530]/60 opacity-60'
                }`}
              >
                <div className="truncate pr-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isThisActive
                          ? 'bg-[#00d084] ring-2 ring-[#00d084]/20'
                          : isConfigured
                          ? 'bg-slate-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-[11px] font-bold text-white truncate block">
                      {b.displayName.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate">
                    {b.type}
                  </span>
                </div>

                <span
                  className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase shrink-0 ${
                    isThisActive
                      ? 'bg-[#00d084]/20 text-[#00d084]'
                      : isConfigured
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {isThisActive ? 'CONN' : isConfigured ? 'READY' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
