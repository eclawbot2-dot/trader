#!/usr/bin/env node
/**
 * Migrate last 48 hours of v1 data into v2 SQLite database
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const V1_DIR = path.join(process.env.HOME, 'Projects/poly-edge');
const V2_DB = path.join(__dirname, 'poly-edge.db');
const CUTOFF = Date.now() - 48 * 60 * 60 * 1000;

const db = new Database(V2_DB);
db.pragma('journal_mode = WAL');

// Ensure schema exists
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, market_id TEXT NOT NULL,
    outcome TEXT NOT NULL, side TEXT NOT NULL, price REAL NOT NULL, size REAL NOT NULL,
    edge REAL NOT NULL, kelly REAL NOT NULL, expected_value REAL NOT NULL, status TEXT NOT NULL,
    tx_hash TEXT, meta TEXT
  );
  CREATE TABLE IF NOT EXISTS positions (
    market_id TEXT NOT NULL, outcome TEXT NOT NULL, size REAL NOT NULL DEFAULT 0,
    avg_price REAL NOT NULL DEFAULT 0, realized_pnl REAL NOT NULL DEFAULT 0,
    unrealized_pnl REAL NOT NULL DEFAULT 0, last_price REAL NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0, winner INTEGER,
    PRIMARY KEY (market_id, outcome)
  );
  CREATE TABLE IF NOT EXISTS balances (
    ts INTEGER PRIMARY KEY, usdc REAL NOT NULL, exposure REAL NOT NULL, equity REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, market_id TEXT NOT NULL,
    amount REAL NOT NULL, tx_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS edge_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, market_id TEXT NOT NULL,
    outcome TEXT NOT NULL, model_prob REAL NOT NULL, market_prob REAL NOT NULL,
    edge REAL NOT NULL, slippage REAL NOT NULL DEFAULT 0, settled INTEGER NOT NULL DEFAULT 0, correct INTEGER
  );
  CREATE TABLE IF NOT EXISTS analytics_timeseries (
    ts INTEGER NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL, tags TEXT,
    PRIMARY KEY(ts, metric, tags)
  );
  CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(ts);
  CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
  CREATE INDEX IF NOT EXISTS idx_edge_market ON edge_observations(market_id);
`);

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// 1. Migrate executed orders → trades
console.log('Migrating trades...');
const orders = readJsonl(path.join(V1_DIR, 'executed-orders.jsonl'));
const insertTrade = db.prepare(`INSERT OR IGNORE INTO trades (ts, market_id, outcome, side, price, size, edge, kelly, expected_value, status, tx_hash, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let tradeCount = 0;
const insertTrades = db.transaction(() => {
  for (const o of orders) {
    const ts = new Date(o.timestamp).getTime();
    if (ts < CUTOFF) continue;
    const ev = o.side === 'BUY' ? (1 - o.price) * parseFloat(o.size || 0) : 0;
    insertTrade.run(
      ts,
      o.tokenId || o.conditionId || '',
      o.team || '',
      o.side || 'BUY',
      o.price || 0,
      parseFloat(o.size || o.cost || 0),
      parseFloat(o.edge || 0),
      0, // kelly not tracked in v1
      ev,
      o.status || 'unknown',
      o.orderId || null,
      JSON.stringify({ game: o.game, sport: o.sport, strategy: o.strategy, traceId: o.traceId, slippage: o.slippage })
    );
    tradeCount++;
  }
});
insertTrades();
console.log(`  Imported ${tradeCount} trades (last 48h)`);

// 2. Migrate positions
console.log('Migrating positions...');
const posFile = path.join(V1_DIR, 'positions.json');
let posCount = 0;
if (fs.existsSync(posFile)) {
  const positions = JSON.parse(fs.readFileSync(posFile, 'utf8'));
  const insertPos = db.prepare(`INSERT OR REPLACE INTO positions (market_id, outcome, size, avg_price, realized_pnl, unrealized_pnl, last_price, resolved, winner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPositions = db.transaction(() => {
    for (const [tokenId, p] of Object.entries(positions)) {
      const entryTime = p.entryTime || 0;
      if (entryTime > 0 && entryTime < CUTOFF) continue;
      insertPos.run(
        tokenId,
        p.team || '',
        p.shares || 0,
        p.entryPrice || 0,
        0, // realized not tracked separately in v1
        0, // will be computed by analytics engine
        p.entryPrice || 0,
        0,
        null
      );
      posCount++;
    }
  });
  insertPositions();
}
console.log(`  Imported ${posCount} positions`);

// 3. Migrate notifications (redemptions)
console.log('Migrating redemptions...');
const notifs = readJsonl(path.join(V1_DIR, 'notifications.jsonl'));
const insertRedemption = db.prepare(`INSERT OR IGNORE INTO redemptions (ts, market_id, amount, tx_hash) VALUES (?, ?, ?, ?)`);
let redeemCount = 0;
const insertRedemptions = db.transaction(() => {
  for (const n of notifs) {
    if (n.type !== 'redeem') continue;
    const ts = new Date(n.time).getTime();
    if (ts < CUTOFF) continue;
    // Parse amount and TX from message
    const amtMatch = n.message && n.message.match(/\$([0-9.]+)\s*USDC/);
    const txMatch = n.message && n.message.match(/TX:\s*(0x[a-f0-9]+)/i);
    const teamMatch = n.message && n.message.match(/AUTO-REDEEMED:\s*(.+?)\s*\|/);
    if (amtMatch && txMatch) {
      insertRedemption.run(ts, teamMatch ? teamMatch[1] : 'unknown', parseFloat(amtMatch[1]), txMatch[1]);
      redeemCount++;
    }
  }
});
insertRedemptions();
console.log(`  Imported ${redeemCount} redemptions`);

// 4. Migrate edge observations from edge-histogram
console.log('Migrating edge observations...');
const edgeFiles = fs.readdirSync(V1_DIR).filter(f => f.startsWith('edge-histogram') && f.endsWith('.jsonl'));
const insertEdge = db.prepare(`INSERT OR IGNORE INTO edge_observations (ts, market_id, outcome, model_prob, market_prob, edge, slippage) VALUES (?, ?, ?, ?, ?, ?, ?)`);
let edgeCount = 0;
const insertEdges = db.transaction(() => {
  for (const ef of edgeFiles) {
    const rows = readJsonl(path.join(V1_DIR, ef));
    for (const r of rows) {
      const ts = r.timestamp ? new Date(r.timestamp).getTime() : (r.ts || 0);
      if (ts < CUTOFF && ts > 0) continue;
      insertEdge.run(
        ts || Date.now(),
        r.tokenId || r.market || '',
        r.team || r.outcome || '',
        r.pinnacleProb || r.modelProb || 0,
        r.polyPrice || r.marketProb || 0,
        parseFloat(r.edge || 0),
        r.slippage || 0
      );
      edgeCount++;
    }
  }
});
insertEdges();
console.log(`  Imported ${edgeCount} edge observations`);

// 5. Migrate alerts
console.log('Migrating alerts...');
const alerts = readJsonl(path.join(V1_DIR, 'alerts.jsonl'));
let alertCount = 0;
const insertTS = db.prepare(`INSERT OR IGNORE INTO analytics_timeseries (ts, metric, value, tags) VALUES (?, ?, ?, ?)`);
const insertAlerts = db.transaction(() => {
  for (const a of alerts) {
    const ts = a.timestamp ? new Date(a.timestamp).getTime() : (a.ts || 0);
    if (ts < CUTOFF && ts > 0) continue;
    insertTS.run(ts || Date.now(), 'alert', 1, JSON.stringify({ type: a.type, message: a.message }));
    alertCount++;
  }
});
insertAlerts();
console.log(`  Imported ${alertCount} alerts`);

db.close();
console.log('\n✅ Migration complete!');
console.log(`  Trades: ${tradeCount}, Positions: ${posCount}, Redemptions: ${redeemCount}, Edges: ${edgeCount}, Alerts: ${alertCount}`);
