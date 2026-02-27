export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export interface Position {
  market_id: string
  outcome: string
  size: number
  avg_price: number
  last_price: number
  unrealized_pnl: number
  resolved?: number
  meta?: unknown
  [key: string]: unknown
}

export interface Trade {
  id?: string
  ts: number
  market_id: string
  outcome: string
  side: 'BUY' | 'SELL' | string
  price: number
  size: number
  edge: number
  expected_value?: number
  kelly?: number
  meta?: unknown
  [key: string]: unknown
}

export interface AlertItem {
  type: string
  message: string
  severity?: 'low' | 'medium' | 'high'
  ts: number
}

export interface Redemption {
  ts: number
  market_id: string
  amount: number
  tx_hash: string
}

export interface DashboardAnalytics {
  pnl?: { realized: number; unrealized: number; total: number }
  roi?: number
  winRate?: number
  sharpe?: number
  maxDrawdown?: number
  edgeAccuracy?: number
  efficiency?: { avgSlippage?: { v?: number } }
}

export interface DashboardPayload {
  positions: Position[]
  trades: Trade[]
  analytics: DashboardAnalytics
  equityCurve: Array<{ ts: number; value: number }>
  drawdownSeries: Array<{ ts: number; value: number }>
  edgeObservations: Array<{ edge: number; correct: number | null }>
  redemptions: Redemption[]
}

export interface BalancePayload {
  usdc: number
  equity: number
}
