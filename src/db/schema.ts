import Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      size REAL NOT NULL,
      edge REAL NOT NULL,
      kelly REAL NOT NULL,
      expected_value REAL NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS positions (
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      size REAL NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL DEFAULT 0,
      realized_pnl REAL NOT NULL DEFAULT 0,
      unrealized_pnl REAL NOT NULL DEFAULT 0,
      last_price REAL NOT NULL DEFAULT 0,
      resolved INTEGER NOT NULL DEFAULT 0,
      winner INTEGER,
      PRIMARY KEY (market_id, outcome)
    );

    CREATE TABLE IF NOT EXISTS balances (
      ts INTEGER PRIMARY KEY,
      usdc REAL NOT NULL,
      exposure REAL NOT NULL,
      equity REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      market_id TEXT NOT NULL,
      amount REAL NOT NULL,
      tx_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_timeseries (
      ts INTEGER NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      tags TEXT,
      PRIMARY KEY(ts, metric, tags)
    );

    CREATE TABLE IF NOT EXISTS edge_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      model_prob REAL NOT NULL,
      market_prob REAL NOT NULL,
      edge REAL NOT NULL,
      slippage REAL NOT NULL DEFAULT 0,
      settled INTEGER NOT NULL DEFAULT 0,
      correct INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(ts);
    CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
    CREATE INDEX IF NOT EXISTS idx_edge_market ON edge_observations(market_id);
  `);
}
