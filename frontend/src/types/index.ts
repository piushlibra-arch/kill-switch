export type TiltStatus = 'green' | 'yellow' | 'orange' | 'red';

export interface Trade {
  id?: number;
  trader_id: string;
  session_id: string;
  instrument: string;
  trade_type: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  position_size: number;
  pnl: number;
  timestamp: string;
  duration_seconds: number;
  atr?: number;
  extension_ratio?: number;
  setup_pattern?: string;
  notes?: string;
}

export interface TiltEvent {
  id?: number;
  trader_id: string;
  session_id: string;
  event_type: string;
  points_added: number;
  timestamp: string;
  trade_id?: number | null;
  metadata?: Record<string, any>;
}

export interface TiltScoreState {
  trader_id: string;
  session_id: string;
  current_score: number;
  status: TiltStatus;
  last_updated: string;
  soft_lock_active: boolean;
  soft_lock_remaining_seconds: number;
  hard_lock_active: boolean;
  hard_lock_remaining_minutes: number;
  events: TiltEvent[];
}

export interface TraderBaseline {
  trader_id: string;
  avg_position_size: number;
  avg_trades_per_hour: number;
  preferred_instruments: string[];
  active_session_hours: string;
  avg_win_rate: number;
  avg_loss_rate: number;
  hard_lock_cooldown_minutes: number;
  soft_lock_cooldown_seconds: number;
  last_calculated?: string;
}

export interface RuleTriggerStat {
  rule_name: string;
  display_name: string;
  count: number;
  total_points: number;
  color: string;
}

export interface HeatmapHourStat {
  hour: number;
  label: string;
  trade_count: number;
  tilt_points: number;
  avg_score: number;
}

export interface TimelinePoint {
  timestamp: string;
  score: number;
  trade_id?: number;
  pnl?: number;
  event_type?: string;
}

export interface AnalyticsData {
  session_id: string;
  trader_id: string;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  current_score: number;
  peak_score: number;
  rule_breakdown: RuleTriggerStat[];
  revenge_trades_history: Array<{
    event_id: number;
    timestamp: string;
    instrument: string;
    seconds_since_loss: number;
    trade_pnl: number;
    position_size: number;
  }>;
  timeline: TimelinePoint[];
  pattern_heatmap: HeatmapHourStat[];
}

export interface SessionSummary {
  session_id: string;
  trader_id: string;
  started_at: string;
  ended_at?: string;
  is_active: boolean;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  peak_tilt_score: number;
  revenge_trades_count: number;
  estimated_revenge_pnl_loss: number;
  emotional_trades: Array<{
    trade_id: number;
    instrument: string;
    trade_type: string;
    pnl: number;
    position_size: number;
    timestamp: string;
    triggered_rules: string[];
    is_revenge: boolean;
  }>;
  suggestions: string[];
}

export type BrokerName = 'dhan' | 'zerodha' | 'fyers' | 'upstox' | 'angelone' | 'breeze' | 'alpaca' | 'binance';

export interface BrokerSettings {
  auto_cancel_orders_on_lock: boolean;
  auto_square_off_on_lock: boolean;
  sync_interval_seconds: number;
}

export interface BrokerConfigItem {
  id: number;
  trader_id: string;
  broker_name: BrokerName;
  client_id_masked?: string;
  api_key_masked?: string;
  token_expiry?: string;
  is_active: boolean;
  is_sandbox: boolean;
  last_sync_at?: string;
  webhook_url?: string;
  settings: BrokerSettings;
}

export interface BrokerPosition {
  symbol: string;
  product_type: string;
  quantity: number;
  buy_price: number;
  current_price: number;
  pnl: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  exchange: string;
}

export interface BrokerOrder {
  order_id: string;
  broker_order_id?: string;
  symbol: string;
  order_type: string;
  transaction_type: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  trigger_price?: number;
  status: string;
  order_timestamp: string;
  rejection_reason?: string;
  tag?: string;
}

export interface BrokerAccountInfo {
  broker_name: string;
  client_id: string;
  available_cash: number;
  utilized_margin: number;
  total_collateral: number;
  currency: string;
  is_live: boolean;
  connected_at: string;
}
