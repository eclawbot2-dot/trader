import Database from 'better-sqlite3';
import { initSchema } from './schema.js';
export class Db {
    db;
    constructor(path) {
        this.db = new Database(path);
        initSchema(this.db);
    }
    insertTrade(t) {
        this.db
            .prepare(`INSERT INTO trades(ts, market_id, outcome, side, price, size, edge, kelly, expected_value, status, tx_hash, meta)
        VALUES(@ts,@marketId,@outcome,@side,@price,@size,@edge,@kelly,@expectedValue,@status,@txHash,@meta)`)
            .run({ ...t, meta: t.meta ? JSON.stringify(t.meta) : null });
    }
    upsertPosition(input) {
        this.db
            .prepare(`INSERT INTO positions(market_id, outcome, size, avg_price, last_price, realized_pnl, unrealized_pnl, resolved, winner)
        VALUES(@marketId,@outcome,@size,@avgPrice,@lastPrice,@realizedPnl,@unrealizedPnl,@resolved,@winner)
        ON CONFLICT(market_id,outcome) DO UPDATE SET
        size=excluded.size, avg_price=excluded.avg_price, last_price=excluded.last_price,
        realized_pnl=excluded.realized_pnl, unrealized_pnl=excluded.unrealized_pnl,
        resolved=excluded.resolved, winner=excluded.winner`)
            .run({ realizedPnl: 0, unrealizedPnl: 0, resolved: 0, winner: null, ...input });
    }
    listPositions() {
        return this.db.prepare('SELECT * FROM positions ORDER BY market_id, outcome').all();
    }
    listTrades(limit = 200) {
        return this.db.prepare('SELECT * FROM trades ORDER BY ts DESC LIMIT ?').all(limit);
    }
    recordBalance(ts, usdc, exposure, equity) {
        this.db.prepare('INSERT OR REPLACE INTO balances(ts, usdc, exposure, equity) VALUES(?,?,?,?)').run(ts, usdc, exposure, equity);
    }
    latestBalance() {
        return this.db.prepare('SELECT * FROM balances ORDER BY ts DESC LIMIT 1').get();
    }
    insertTimeSeries(ts, metric, value, tags) {
        this.db.prepare('INSERT OR REPLACE INTO analytics_timeseries(ts, metric, value, tags) VALUES (?,?,?,?)').run(ts, metric, value, tags ? JSON.stringify(tags) : null);
    }
    getTimeSeries(metric, limit = 500) {
        return this.db.prepare('SELECT * FROM analytics_timeseries WHERE metric = ? ORDER BY ts DESC LIMIT ?').all(metric, limit);
    }
    close() {
        this.db.close();
    }
}
