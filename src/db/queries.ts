import Database from 'better-sqlite3';
import { initSchema } from './schema.js';

export interface TradeInput {
  ts: number;
  marketId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  edge: number;
  kelly: number;
  expectedValue: number;
  status: string;
  txHash?: string;
  meta?: Record<string, unknown>;
}

export class Db {
  public readonly db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    initSchema(this.db);
  }

  insertTrade(t: TradeInput): void {
    this.db
      .prepare(`INSERT INTO trades(ts, market_id, outcome, side, price, size, edge, kelly, expected_value, status, tx_hash, meta)
        VALUES(@ts,@marketId,@outcome,@side,@price,@size,@edge,@kelly,@expectedValue,@status,@txHash,@meta)`)
      .run({ ...t, meta: t.meta ? JSON.stringify(t.meta) : null });
  }

  upsertPosition(input: { marketId: string; outcome: string; size: number; avgPrice: number; lastPrice: number; realizedPnl?: number; unrealizedPnl?: number; resolved?: number; winner?: number | null; }): void {
    this.db
      .prepare(`INSERT INTO positions(market_id, outcome, size, avg_price, last_price, realized_pnl, unrealized_pnl, resolved, winner)
        VALUES(@marketId,@outcome,@size,@avgPrice,@lastPrice,@realizedPnl,@unrealizedPnl,@resolved,@winner)
        ON CONFLICT(market_id,outcome) DO UPDATE SET
        size=excluded.size, avg_price=excluded.avg_price, last_price=excluded.last_price,
        realized_pnl=excluded.realized_pnl, unrealized_pnl=excluded.unrealized_pnl,
        resolved=excluded.resolved, winner=excluded.winner`)
      .run({ realizedPnl: 0, unrealizedPnl: 0, resolved: 0, winner: null, ...input });
  }

  listPositions(): unknown[] {
    return this.db.prepare('SELECT * FROM positions ORDER BY market_id, outcome').all();
  }

  listTrades(limit = 200): unknown[] {
    // Deduplicate: migration doubled all v1 trades. Use MIN(id) to pick one per unique trade.
    return this.db.prepare(`
      SELECT t.* FROM trades t
      INNER JOIN (
        SELECT MIN(id) as id FROM trades GROUP BY ts, market_id, outcome, side, price, size, edge, status
      ) dedup ON t.id = dedup.id
      ORDER BY t.ts DESC LIMIT ?
    `).all(limit);
  }

  recordBalance(ts: number, usdc: number, exposure: number, equity: number): void {
    this.db.prepare('INSERT OR REPLACE INTO balances(ts, usdc, exposure, equity) VALUES(?,?,?,?)').run(ts, usdc, exposure, equity);
  }

  latestBalance(): unknown {
    return this.db.prepare('SELECT * FROM balances ORDER BY ts DESC LIMIT 1').get();
  }

  insertTimeSeries(ts: number, metric: string, value: number, tags?: Record<string, unknown>): void {
    this.db.prepare('INSERT OR REPLACE INTO analytics_timeseries(ts, metric, value, tags) VALUES (?,?,?,?)').run(ts, metric, value, tags ? JSON.stringify(tags) : null);
  }

  getTimeSeries(metric: string, limit = 500): unknown[] {
    return this.db.prepare('SELECT * FROM analytics_timeseries WHERE metric = ? ORDER BY ts DESC LIMIT ?').all(metric, limit);
  }

  close(): void {
    this.db.close();
  }
}
