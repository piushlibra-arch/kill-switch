import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TiltStatus, TiltEvent, Trade, TraderBaseline, TiltScoreState } from '../types';
import { api } from '../api/client';

interface Toast {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
}

interface TiltContextType {
  traderId: string;
  setTraderId: (id: string) => void;
  currentScore: number;
  status: TiltStatus;
  sessionId: string;
  softLockActive: boolean;
  softLockRemainingSeconds: number;
  hardLockActive: boolean;
  hardLockRemainingMinutes: number;
  events: TiltEvent[];
  trades: Trade[];
  baseline: TraderBaseline | null;
  isWsConnected: boolean;
  toasts: Toast[];
  removeToast: (id: string) => void;
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  
  // Modals
  isSoftLockModalOpen: boolean;
  setIsSoftLockModalOpen: (open: boolean) => void;
  isHardLockModalOpen: boolean;
  setIsHardLockModalOpen: (open: boolean) => void;
  isResetModalOpen: boolean;
  setIsResetModalOpen: (open: boolean) => void;

  // Actions
  submitTrade: (tradeData: any) => Promise<any>;
  overrideLock: (reason: string) => Promise<void>;
  resetScore: (reason: string) => Promise<void>;
  confirmSoftLock: (phrase: string) => Promise<void>;
  startNewSession: (notes?: string) => Promise<void>;
  endCurrentSession: (notes?: string) => Promise<any>;
  refreshAll: () => Promise<void>;
  updateBaselineSettings: (data: Partial<TraderBaseline>) => Promise<void>;
}

const TiltContext = createContext<TiltContextType | undefined>(undefined);

export const TiltProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [traderId, setTraderId] = useState<string>('trader_alpha');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [status, setStatus] = useState<TiltStatus>('green');
  const [sessionId, setSessionId] = useState<string>('');
  const [softLockActive, setSoftLockActive] = useState<boolean>(false);
  const [softLockRemainingSeconds, setSoftLockRemainingSeconds] = useState<number>(0);
  const [hardLockActive, setHardLockActive] = useState<boolean>(false);
  const [hardLockRemainingMinutes, setHardLockRemainingMinutes] = useState<number>(0);
  const [events, setEvents] = useState<TiltEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [baseline, setBaseline] = useState<TraderBaseline | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [isSoftLockModalOpen, setIsSoftLockModalOpen] = useState<boolean>(false);
  const [isHardLockModalOpen, setIsHardLockModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  const addToast = useCallback((toast: Omit<Toast, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [{ ...toast, id, timestamp: new Date() }, ...prev.slice(0, 4)]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Soft lock countdown timer
  useEffect(() => {
    if (!softLockActive || softLockRemainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setSoftLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setSoftLockActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [softLockActive, softLockRemainingSeconds]);

  // Load initial data
  const refreshAll = useCallback(async () => {
    try {
      const [scoreData, eventsData, tradesData, baselineData, sessionData] = await Promise.all([
        api.getTiltScore(traderId),
        api.getTiltEvents(traderId),
        api.getTrades(traderId),
        api.getBaseline(traderId),
        api.getCurrentSession(traderId),
      ]);

      setCurrentScore(scoreData.current_score);
      setStatus(scoreData.status);
      setSessionId(scoreData.session_id || sessionData.session_id);
      setSoftLockActive(scoreData.soft_lock_active);
      setSoftLockRemainingSeconds(scoreData.soft_lock_remaining_seconds || 0);
      setHardLockActive(scoreData.hard_lock_active);
      setHardLockRemainingMinutes(scoreData.hard_lock_remaining_minutes || 0);
      setEvents(eventsData || []);
      setTrades(tradesData || []);
      setBaseline(baselineData);

      if (scoreData.status === 'orange') {
        setIsSoftLockModalOpen(true);
      } else if (scoreData.status === 'red') {
        setIsHardLockModalOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to load initial tilt state:', err);
    }
  }, [traderId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Setup WebSocket connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    // In dev Vite proxy or direct
    const wsUrl = `${wsProtocol}//${wsHost}/ws/tilt/${traderId}`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INITIAL_STATE' || data.type === 'TILT_SCORE_UPDATE') {
              setCurrentScore(data.current_score);
              setStatus(data.status);
              if (data.session_id) setSessionId(data.session_id);
              if (data.soft_lock_active !== undefined) setSoftLockActive(data.soft_lock_active);
              if (data.hard_lock_active !== undefined) setHardLockActive(data.hard_lock_active);

              if (data.action_required === 'warning') {
                addToast({
                  type: 'warning',
                  title: 'Tilt Warning (Yellow Zone)',
                  message: `Score elevated to ${data.current_score}. Emotional trading indicators detected.`,
                });
              } else if (data.action_required === 'soft_lock') {
                setSoftLockRemainingSeconds(60);
                setIsSoftLockModalOpen(true);
                addToast({
                  type: 'error',
                  title: '🟠 Soft Lock Engaged!',
                  message: 'Score reached Orange zone. 60s cooldown or trade confirmation required.',
                });
              } else if (data.action_required === 'hard_lock') {
                setHardLockRemainingMinutes(30);
                setIsHardLockModalOpen(true);
                addToast({
                  type: 'error',
                  title: '🛑 KILL SWITCH HARD LOCK!',
                  message: 'Severe tilt detected (90+). Trading locked for 30 min minimum.',
                });
              }

              if (data.triggered_events && data.triggered_events.length > 0) {
                setEvents((prev) => [...data.triggered_events, ...prev]);
              }
              if (data.latest_trade) {
                setTrades((prev) => [data.latest_trade, ...prev]);
              }
            } else if (data.type === 'KILL_SWITCH_OVERRIDE') {
              setCurrentScore(data.current_score);
              setStatus(data.status);
              setHardLockActive(false);
              setSoftLockActive(false);
              setIsHardLockModalOpen(false);
              setIsSoftLockModalOpen(false);
              addToast({
                type: 'info',
                title: 'Override Acknowledged',
                message: data.message,
              });
            } else if (data.type === 'TILT_SCORE_RESET') {
              setCurrentScore(0);
              setStatus('green');
              setHardLockActive(false);
              setSoftLockActive(false);
              setIsHardLockModalOpen(false);
              setIsSoftLockModalOpen(false);
              addToast({
                type: 'success',
                title: 'Tilt Score Reset',
                message: data.message,
              });
            } else if (data.type === 'SESSION_STARTED') {
              setCurrentScore(0);
              setStatus('green');
              setSessionId(data.session_id);
              setTrades([]);
              setEvents([]);
              addToast({
                type: 'info',
                title: 'New Session Started',
                message: data.message,
              });
            } else if (data.type === 'CURRENCY_CONFIG_UPDATED') {
              window.dispatchEvent(new CustomEvent('currency_config_updated', { detail: data }));
              addToast({
                type: 'info',
                title: 'Currency Config Updated',
                message: `Active currency: ${data.currency_symbol} (${data.currency_code}) for ${data.broker_name.toUpperCase()}`,
              });
            }
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimeout = setTimeout(connect, 2500);
        };

        ws.onerror = () => {
          setIsWsConnected(false);
          ws?.close();
        };
      } catch (err) {
        setIsWsConnected(false);
        reconnectTimeout = setTimeout(connect, 2500);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [traderId, addToast]);

  const submitTrade = async (tradeData: any) => {
    try {
      const res = await api.submitTrade({
        ...tradeData,
        trader_id: traderId,
        session_id: sessionId,
      });

      // Update state locally
      setCurrentScore(res.current_tilt_score);
      setStatus(res.tilt_status);
      if (res.triggered_events?.length > 0) {
        setEvents((prev) => [...res.triggered_events, ...prev]);
      }
      setTrades((prev) => [res, ...prev]);

      if (res.action_required === 'soft_lock') {
        setIsSoftLockModalOpen(true);
        setSoftLockActive(true);
        setSoftLockRemainingSeconds(60);
      } else if (res.action_required === 'hard_lock') {
        setIsHardLockModalOpen(true);
        setHardLockActive(true);
        setHardLockRemainingMinutes(30);
      }

      addToast({
        type: res.pnl >= 0 ? 'success' : 'warning',
        title: `Trade ${res.instrument} ${res.trade_type.toUpperCase()}`,
        message: `PnL: ${res.pnl > 0 ? '+' : ''}${res.pnl} | Tilt Score: ${res.current_tilt_score}`,
      });

      return res;
    } catch (err: any) {
      if (err.message && err.message.includes('Soft lock')) {
        setIsSoftLockModalOpen(true);
      } else if (err.message && err.message.includes('Kill Switch')) {
        setIsHardLockModalOpen(true);
      }
      addToast({
        type: 'error',
        title: 'Trade Execution Blocked',
        message: err.message || 'Intervention system prevented trade.',
      });
      throw err;
    }
  };

  const overrideLock = async (reason: string) => {
    const res = await api.overrideKillSwitch(traderId, reason);
    setCurrentScore(res.current_score);
    setStatus(res.tilt_status as TiltStatus);
    setHardLockActive(false);
    setSoftLockActive(false);
    setIsHardLockModalOpen(false);
    setIsSoftLockModalOpen(false);
    addToast({
      type: 'info',
      title: 'Kill Switch Overridden',
      message: 'Override recorded in immutable audit log.',
    });
  };

  const resetScore = async (reason: string) => {
    const res = await api.resetTiltScore(traderId, reason);
    setCurrentScore(0);
    setStatus('green');
    setHardLockActive(false);
    setSoftLockActive(false);
    setIsResetModalOpen(false);
    setIsHardLockModalOpen(false);
    setIsSoftLockModalOpen(false);
    addToast({
      type: 'success',
      title: 'Score Reset',
      message: 'Tilt score restored to 0.',
    });
  };

  const confirmSoftLock = async (phrase: string) => {
    await api.softUnlock(traderId, phrase);
    setSoftLockActive(false);
    setIsSoftLockModalOpen(false);
    addToast({
      type: 'success',
      title: 'Soft Lock Cleared',
      message: 'Trade confirmation recorded. You can now execute.',
    });
  };

  const startNewSession = async (notes?: string) => {
    const res = await api.startSession(traderId, notes);
    setSessionId(res.session_id);
    setCurrentScore(0);
    setStatus('green');
    setTrades([]);
    setEvents([]);
    addToast({
      type: 'info',
      title: 'Session Started',
      message: `Active session: ${res.session_id}`,
    });
  };

  const endCurrentSession = async (notes?: string) => {
    const summary = await api.endSession(traderId, notes);
    addToast({
      type: 'info',
      title: 'Session Concluded',
      message: `Total PnL: ${summary.total_pnl >= 0 ? '+' : ''}${summary.total_pnl} (${summary.win_rate * 100}% win rate)`,
    });
    return summary;
  };

  const updateBaselineSettings = async (data: Partial<TraderBaseline>) => {
    const updated = await api.updateBaseline(traderId, data);
    setBaseline(updated);
    addToast({
      type: 'success',
      title: 'Baseline Updated',
      message: 'Risk parameters saved successfully.',
    });
  };

  return (
    <TiltContext.Provider
      value={{
        traderId,
        setTraderId,
        currentScore,
        status,
        sessionId,
        softLockActive,
        softLockRemainingSeconds,
        hardLockActive,
        hardLockRemainingMinutes,
        events,
        trades,
        baseline,
        isWsConnected,
        toasts,
        removeToast,
        addToast,
        isSoftLockModalOpen,
        setIsSoftLockModalOpen,
        isHardLockModalOpen,
        setIsHardLockModalOpen,
        isResetModalOpen,
        setIsResetModalOpen,
        submitTrade,
        overrideLock,
        resetScore,
        confirmSoftLock,
        startNewSession,
        endCurrentSession,
        refreshAll,
        updateBaselineSettings,
      }}
    >
      {children}
    </TiltContext.Provider>
  );
};

export const useTilt = () => {
  const context = useContext(TiltContext);
  if (!context) {
    throw new Error('useTilt must be used within a TiltProvider');
  }
  return context;
};
