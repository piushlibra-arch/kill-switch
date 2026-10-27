import React, { useState, useEffect } from 'react';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../api/client';
import { BrokerName, BrokerPosition, BrokerOrder, BrokerConfigItem } from '../types';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  ShieldAlert, 
  Send, 
  Lock, 
  Key, 
  ExternalLink,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface BrokerMeta {
  name: BrokerName;
  displayName: string;
  badge: string;
  tagline: string;
  authType: 'token' | 'oauth' | 'totp';
  docsUrl: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type?: string;
    required?: boolean;
    helper?: string;
  }[];
}

const BROKERS: BrokerMeta[] = [
  {
    name: 'dhan',
    displayName: 'Dhan (Primary)',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tagline: 'Native Order WebSocket & "kill-switch-blocked" tagging',
    authType: 'token',
    docsUrl: 'https://dhanhq.co/docs/live/',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'e.g. 1000284712', required: true },
      { key: 'access_token', label: 'Access Token (JWT)', placeholder: 'Paste Dhan Access Token...', type: 'password', required: true },
    ]
  },
  {
    name: 'upstox',
    displayName: 'Upstox (v2 Sandbox / Live)',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    tagline: 'Full OAuth2 + Dedicated Sandbox Environment for Testing',
    authType: 'oauth',
    docsUrl: 'https://upstox.com/developer/api-documentation/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Upstox API Key...', required: true },
      { key: 'access_token', label: 'Access Token', placeholder: 'OAuth Bearer Token...', type: 'password', required: true },
    ]
  },
  {
    name: 'zerodha',
    displayName: 'Zerodha Kite',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    tagline: 'KiteTicker real-time feed with daily login token refresh',
    authType: 'oauth',
    docsUrl: 'https://kite.trade/docs/connect/v3/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Kite Connect API Key...', required: true },
      { key: 'access_token', label: 'Access Token (Daily)', placeholder: 'Generated daily session access token...', type: 'password', required: true },
    ]
  },
  {
    name: 'fyers',
    displayName: 'Fyers (v3 API)',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    tagline: 'FyersDataSocket & native GTT conditional order support',
    authType: 'oauth',
    docsUrl: 'https://myapi.fyers.in/docsv3',
    fields: [
      { key: 'client_id', label: 'App ID (Client ID)', placeholder: 'e.g. XC12345-100', required: true },
      { key: 'access_token', label: 'Access Token', placeholder: 'Fyers OAuth Access Token...', type: 'password', required: true },
    ]
  },
  {
    name: 'angelone',
    displayName: 'Angel One (SmartAPI)',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    tagline: 'Automated 2FA login with TOTP generation & SmartWebSocket',
    authType: 'totp',
    docsUrl: 'https://smartapi.angelbroking.com/',
    fields: [
      { key: 'api_key', label: 'SmartAPI Key', placeholder: 'Angel One API Key...', required: true },
      { key: 'client_id', label: 'Client Code', placeholder: 'e.g. A123456', required: true },
      { key: 'pin', label: 'MPIN / Password', placeholder: 'Account MPIN...', type: 'password', required: true },
      { key: 'totp_secret', label: 'TOTP Secret Key (Base32)', placeholder: 'e.g. JBSWY3DPEHPK3PXP', helper: 'AegisTilt auto-generates 6-digit 2FA OTP codes on refresh' },
    ]
  },
  {
    name: 'breeze',
    displayName: 'ICICI Breeze',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    tagline: 'SHA256 authenticated API for direct order & position feeds',
    authType: 'token',
    docsUrl: 'https://api.icicidirect.com/breezeapi/documents/index.html',
    fields: [
      { key: 'api_key', label: 'App Key', placeholder: 'Breeze App Key...', required: true },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Breeze Secret Key...', type: 'password', required: true },
      { key: 'access_token', label: 'Session Token', placeholder: 'Daily Session Token...', type: 'password', required: true },
    ]
  },
  {
    name: 'alpaca',
    displayName: 'Alpaca / US ($)',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tagline: 'US Equities & Options with standard USD ($) formatting',
    authType: 'token',
    docsUrl: 'https://alpaca.markets/docs/',
    fields: [
      { key: 'api_key', label: 'API Key ID', placeholder: 'e.g. PKX129849102', required: true },
      { key: 'secret_key', label: 'API Secret Key', placeholder: 'Alpaca Secret Key...', type: 'password', required: true },
    ]
  },
  {
    name: 'binance',
    displayName: 'Binance / Crypto (USDT)',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    tagline: 'Crypto Perpetual Futures with Tether (USDT) pricing',
    authType: 'token',
    docsUrl: 'https://binance-docs.github.io/apidocs/futures/en/',
    fields: [
      { key: 'api_key', label: 'Binance API Key', placeholder: 'Binance API Key...', required: true },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Binance Secret Key...', type: 'password', required: true },
    ]
  }
];

export const BrokerIntegrationCard: React.FC = () => {
  const { traderId, addToast, softLockActive, hardLockActive } = useTilt();
  const { formatCurrency, currencySymbol, refreshCurrencyConfig } = useCurrency();

  const [selectedBroker, setSelectedBroker] = useState<BrokerName>('dhan');
  const [formData, setFormData] = useState<Record<string, string>>({
    client_id: '',
    access_token: '',
  });
  const [isSandbox, setIsSandbox] = useState<boolean>(false);
  const [autoCancelOnLock, setAutoCancelOnLock] = useState<boolean>(true);
  const [autoSquareOffOnLock, setAutoSquareOffOnLock] = useState<boolean>(false);
  const [syncInterval, setSyncInterval] = useState<number>(30);

  const [connectedBrokers, setConnectedBrokers] = useState<BrokerConfigItem[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Test order dialog
  const [testSymbol, setTestSymbol] = useState('NIFTY26OCT24500CE');
  const [testQty, setTestQty] = useState('50');
  const [testType, setTestType] = useState<'BUY' | 'SELL'>('BUY');
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);

  // Load configs
  const loadConfigs = async () => {
    try {
      const cfgs = await api.getBrokerConfigs(traderId);
      setConnectedBrokers(cfgs || []);
      const active = (cfgs || []).find((c: any) => c.is_active);
      if (active) {
        setSelectedBroker(active.broker_name);
        setIsSandbox(Boolean(active.is_sandbox));
        setAutoCancelOnLock(active.settings?.auto_cancel_orders_on_lock ?? true);
        setAutoSquareOffOnLock(active.settings?.auto_square_off_on_lock ?? false);
        setSyncInterval(active.settings?.sync_interval_seconds ?? 30);
        if (active.last_sync_at) {
          setLastSyncTime(new Date(active.last_sync_at).toLocaleTimeString());
        }
        setFormData((prev) => ({
          ...prev,
          client_id: active.client_id_masked || prev.client_id || '',
          api_key: active.api_key_masked || prev.api_key || '',
        }));
      }
    } catch (err) {
      console.error('Error fetching broker configs:', err);
    }
  };

  const loadPositionsAndOrders = async () => {
    try {
      const [p, o] = await Promise.all([
        api.getBrokerPositions(traderId),
        api.getBrokerOrders(traderId),
      ]);
      setPositions(p || []);
      setOrders(o || []);
    } catch (err) {
      console.error('Error loading positions/orders:', err);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadPositionsAndOrders();
  }, [traderId]);

  const activeMeta = BROKERS.find((b) => b.name === selectedBroker) || BROKERS[0];
  const currentConfig = connectedBrokers.find((c) => c.broker_name === selectedBroker);
  const isConnected = Boolean(currentConfig && currentConfig.is_active);

  const handleInputChange = (key: string, val: string) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await api.connectBroker(selectedBroker, {
        trader_id: traderId,
        ...formData,
        is_sandbox: isSandbox,
        auto_cancel_orders_on_lock: autoCancelOnLock,
        auto_square_off_on_lock: autoSquareOffOnLock,
        sync_interval_seconds: syncInterval,
      });

      addToast({
        type: 'success',
        title: `${activeMeta.displayName} Connected`,
        message: `Active currency: ${res.currency_symbol || '₹'} (${res.currency_code || 'INR'}) | Available margin: ${res.currency_symbol || '₹'}${res.account_info?.available_cash?.toLocaleString() || '3,42,500'} (${isSandbox ? 'Sandbox' : 'Live'})`,
      });

      await refreshCurrencyConfig();
      await loadConfigs();
      await loadPositionsAndOrders();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Connection Failed',
        message: err.message || 'Unable to authenticate with broker API',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectBroker(selectedBroker, traderId);
      addToast({
        type: 'info',
        title: `${activeMeta.displayName} Disconnected`,
        message: 'Broker connection deactivated.',
      });
      await loadConfigs();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await api.syncBrokerNow(traderId);
      setLastSyncTime(new Date().toLocaleTimeString());
      addToast({
        type: 'success',
        title: 'Broker Telemetry Synced',
        message: `${res.synced_trades} trades processed, ${res.positions_count} open positions updated.`,
      });
      await loadPositionsAndOrders();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: err.message || 'Error syncing trades with broker',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePlaceTestOrder = async () => {
    setPlacingOrder(true);
    try {
      const res = await api.placeBrokerOrder(traderId, {
        symbol: testSymbol.trim().toUpperCase(),
        transaction_type: testType,
        order_type: 'MARKET',
        quantity: parseFloat(testQty) || 50,
        price: 100.0,
        product_type: 'INTRADAY',
        tag: 'aegis-test'
      });

      addToast({
        type: 'success',
        title: 'Broker Order Executed',
        message: `${testType} ${testQty} ${testSymbol} placed on ${activeMeta.displayName}.`,
      });
      await loadPositionsAndOrders();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Order Intercepted / Blocked',
        message: err.message || 'Kill Switch blocked order execution.',
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Broker Header & Selection Card */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Unified Broker Integration Layer
              </h2>
              <p className="text-xs text-slate-400">
                Single abstract interface ensuring identical Kill Switch enforcement across all brokers.
              </p>
            </div>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>{isConnected ? `${activeMeta.displayName}: LIVE SYNC` : 'DISCONNECTED'}</span>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition-all"
            >
              <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>

        {/* Broker Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {BROKERS.map((b) => {
            const isSel = selectedBroker === b.name;
            const isConn = connectedBrokers.some((c) => c.broker_name === b.name && c.is_active);

            return (
              <button
                key={b.name}
                type="button"
                onClick={() => {
                  setSelectedBroker(b.name);
                  const existing = connectedBrokers.find((c) => c.broker_name === b.name);
                  if (existing) {
                    setIsSandbox(Boolean(existing.is_sandbox));
                    setFormData({
                      client_id: existing.client_id_masked || '',
                      api_key: existing.api_key_masked || '',
                      access_token: '',
                    });
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSel
                    ? 'bg-slate-800/90 border-rose-500 shadow-md shadow-rose-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                {isConn && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                )}
                <span className="block text-xs font-bold text-white tracking-tight">
                  {b.displayName.split(' ')[0]}
                </span>
                <span className="block text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {b.name.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Broker Configuration Form */}
        <div className="bg-slate-950/60 rounded-xl p-4 sm:p-5 border border-slate-800 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{activeMeta.displayName} Configuration</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${activeMeta.badge}`}>
                  {activeMeta.authType.toUpperCase()} AUTH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeMeta.tagline}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsSandbox(true);
                  if (activeMeta.name === 'dhan') {
                    setFormData({ client_id: 'DHAN_1002348', access_token: 'dhan_demo_jwt_access_token_secure' });
                  } else if (activeMeta.name === 'upstox') {
                    setFormData({ api_key: 'upstox_sandbox_key', access_token: 'upstox_oauth_token_v2' });
                  } else if (activeMeta.name === 'zerodha') {
                    setFormData({ api_key: 'kite_key_9921', access_token: 'kite_daily_session_token' });
                  } else if (activeMeta.name === 'fyers') {
                    setFormData({ client_id: 'FYERS_XC12345', access_token: 'fyers_oauth2_token' });
                  } else if (activeMeta.name === 'angelone') {
                    setFormData({ api_key: 'smartapi_key_88', client_id: 'A102938', pin: '4821', totp_secret: 'JBSWY3DPEHPK3PXP' });
                  } else if (activeMeta.name === 'breeze') {
                    setFormData({ api_key: 'breeze_app_key', secret_key: 'breeze_sec_key', access_token: 'breeze_session_token' });
                  } else if (activeMeta.name === 'alpaca') {
                    setFormData({ api_key: 'alpaca_pk_live', secret_key: 'alpaca_sk_live' });
                  } else if (activeMeta.name === 'binance') {
                    setFormData({ api_key: 'binance_futures_api_key', secret_key: 'binance_futures_sec_key' });
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-mono px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 transition-all"
              >
                Fill Demo Credentials
              </button>
              <a
                href={activeMeta.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1 shrink-0"
              >
                <span>API Reference</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activeMeta.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    {f.label} {f.required && !isConnected && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={formData[f.key] || ''}
                    onChange={(e) => handleInputChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    required={f.required && !isConnected}
                  />
                  {f.helper && (
                    <span className="text-[10px] text-slate-500 mt-1 block font-mono">{f.helper}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Sandbox & Sync Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isSandbox 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              }`}>
                <input
                  type="checkbox"
                  checked={isSandbox}
                  onChange={(e) => setIsSandbox(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold block font-mono">
                    {isSandbox ? 'Sandbox / Mock Mode' : 'LIVE API Connection'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isSandbox ? 'Uses simulated demo data & orders' : 'Direct API calls with live credentials'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCancelOnLock}
                  onChange={(e) => setAutoCancelOnLock(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold block">Auto-Cancel on Hard Lock</span>
                  <span className="text-[10px] text-slate-500">Purges pending orders at broker</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSquareOffOnLock}
                  onChange={(e) => setAutoSquareOffOnLock(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold block">Auto-Square-Off Positions</span>
                  <span className="text-[10px] text-slate-500">Closes open risk during tilt panic</span>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <span className="text-xs text-slate-400 font-mono">
                Credentials encrypted with AES-128-CBC before persistence.
              </span>

              <div className="flex items-center gap-2">
                {isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
                  >
                    Disconnect
                  </button>
                )}

                <button
                  type="submit"
                  disabled={connecting}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Key className="w-3.5 h-3.5" />
                  {connecting ? 'Authenticating...' : isConnected ? 'Update & Reconnect' : 'Connect Broker'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 2-Column: Open Positions & Test Order Challenge */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Open Positions from Broker (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase text-slate-200">
                    Live Broker Positions ({positions.length})
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Last sync: {lastSyncTime}
                </span>
              </div>

              {positions.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No active open positions on {activeMeta.displayName}.
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-48 pr-1">
                  {positions.map((p, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <span className="font-bold text-white block">{p.symbol}</span>
                        <span className="text-[10px] text-slate-400">
                          Qty: {p.quantity} • Buy: {formatCurrency(p.buy_price)} • LTP: {formatCurrency(p.current_price)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold block ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(p.pnl, { showSign: true })}
                        </span>
                        <span className="text-[10px] text-slate-500">{p.exchange}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Place Order Through Kill Switch Interceptor (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-bold uppercase text-slate-200">
                  Kill Switch Order Interceptor
                </h4>
              </div>

              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                Test routing an order through AegisTilt. If Kill Switch is Engaged (Red Zone), the intelligence layer intercepts and blocks the order before reaching {activeMeta.displayName}.
              </p>

              <div className="space-y-2.5 mb-3 text-xs">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-0.5">Instrument</label>
                  <input
                    type="text"
                    value={testSymbol}
                    onChange={(e) => setTestSymbol(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-0.5">Quantity</label>
                    <input
                      type="number"
                      value={testQty}
                      onChange={(e) => setTestQty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-0.5">Side</label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setTestType('BUY')}
                        className={`py-1 text-[11px] font-bold rounded ${
                          testType === 'BUY' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={() => setTestType('SELL')}
                        className={`py-1 text-[11px] font-bold rounded ${
                          testType === 'SELL' ? 'bg-rose-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePlaceTestOrder}
              disabled={placingOrder}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                hardLockActive
                  ? 'bg-rose-950 border border-rose-500/60 text-rose-300 hover:bg-rose-900'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {placingOrder ? 'Routing...' : hardLockActive ? 'Test Order (Will Be Blocked)' : 'Route Order to Broker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
