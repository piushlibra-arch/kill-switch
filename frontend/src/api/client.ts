import { 
  TiltScoreState, 
  TiltEvent, 
  Trade, 
  TraderBaseline, 
  AnalyticsData, 
  SessionSummary 
} from '../types';

const API_BASE = '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorDetail = 'Request failed';
    try {
      const err = await res.json();
      errorDetail = err.detail?.message || err.detail || JSON.stringify(err);
    } catch {
      errorDetail = `${res.status} ${res.statusText}`;
    }
    throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
  }

  return res.json();
}

export const api = {
  getTiltScore: (traderId: string) => 
    fetchJson<TiltScoreState>(`${API_BASE}/tilt-score/${traderId}`),

  getTiltEvents: (traderId: string) => 
    fetchJson<TiltEvent[]>(`${API_BASE}/tilt-events/${traderId}`),

  getTrades: (traderId: string) => 
    fetchJson<Trade[]>(`${API_BASE}/trades/${traderId}`),

  submitTrade: (tradeData: Partial<Trade> & { soft_lock_confirmed_text?: string; override_reason?: string }) => 
    fetchJson<any>(`${API_BASE}/trades`, {
      method: 'POST',
      body: JSON.stringify(tradeData),
    }),

  overrideKillSwitch: (traderId: string, override_reason: string) => 
    fetchJson<{ status: string; message: string; current_score: number; tilt_status: string }>(`${API_BASE}/kill-switch/override`, {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, override_reason }),
    }),

  resetTiltScore: (traderId: string, reason: string) => 
    fetchJson<{ status: string; message: string; current_score: number; tilt_status: string }>(`${API_BASE}/kill-switch/reset`, {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, reason }),
    }),

  softUnlock: (traderId: string, confirmation_phrase: string) => 
    fetchJson<{ status: string; message: string }>(`${API_BASE}/kill-switch/soft-unlock`, {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, confirmation_phrase }),
    }),

  getBaseline: (traderId: string) => 
    fetchJson<TraderBaseline>(`${API_BASE}/baseline/${traderId}`),

  updateBaseline: (traderId: string, data: Partial<TraderBaseline>) => 
    fetchJson<TraderBaseline>(`${API_BASE}/baseline/${traderId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recalculateBaseline: (traderId: string) => 
    fetchJson<TraderBaseline>(`${API_BASE}/baseline/${traderId}/recalculate`, {
      method: 'POST',
    }),

  getAnalytics: (traderId: string) => 
    fetchJson<AnalyticsData>(`${API_BASE}/analytics/${traderId}`),

  startSession: (traderId: string, notes?: string) => 
    fetchJson<{ status: string; session_id: string }>(`${API_BASE}/session/start`, {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, notes }),
    }),

  endSession: (traderId: string, notes?: string) => 
    fetchJson<SessionSummary>(`${API_BASE}/session/end`, {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, notes }),
    }),

  getCurrentSession: (traderId: string) => 
    fetchJson<any>(`${API_BASE}/session/current/${traderId}`),

  getSessionSummary: (sessionId: string) => 
    fetchJson<SessionSummary>(`${API_BASE}/session/summary/${sessionId}`),

  // Broker APIs
  connectBroker: (brokerName: string, data: any) =>
    fetchJson<any>(`${API_BASE}/broker/${brokerName}/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  disconnectBroker: (brokerName: string, traderId: string) =>
    fetchJson<any>(`${API_BASE}/broker/${brokerName}/disconnect?trader_id=${traderId}`, {
      method: 'POST',
    }),

  getBrokerConfigs: (traderId: string) =>
    fetchJson<any[]>(`${API_BASE}/broker/configs/${traderId}`),

  getActiveBrokerConfig: (traderId: string) =>
    fetchJson<any>(`${API_BASE}/broker/active-config?trader_id=${encodeURIComponent(traderId)}`),

  updateBrokerSettings: (traderId: string, settings: any) =>
    fetchJson<any>(`${API_BASE}/broker/configs/${traderId}/settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  syncBrokerNow: (traderId: string) =>
    fetchJson<any>(`${API_BASE}/broker/sync/${traderId}`, {
      method: 'POST',
    }),

  getBrokerPositions: (traderId: string) =>
    fetchJson<any[]>(`${API_BASE}/broker/positions/${traderId}`),

  getBrokerOrders: (traderId: string) =>
    fetchJson<any[]>(`${API_BASE}/broker/orders/${traderId}`),

  placeBrokerOrder: (traderId: string, orderData: any, soft_lock_confirmation?: string) =>
    fetchJson<any>(`${API_BASE}/broker/orders/${traderId}${soft_lock_confirmation ? `?soft_lock_confirmation=${encodeURIComponent(soft_lock_confirmation)}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),

  cancelBrokerOrder: (traderId: string, orderId: string) =>
    fetchJson<any>(`${API_BASE}/broker/orders/${traderId}/${orderId}`, {
      method: 'DELETE',
    }),

  refreshBrokerToken: (brokerName: string, data: { trader_id: string; access_token: string }) =>
    fetchJson<any>(`${API_BASE}/broker/${brokerName}/refresh-token`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
