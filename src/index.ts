import http from 'node:http';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { Db } from './db/queries.js';
import { bus } from './notifications/emitter.js';
import { wireTelegramNotifications } from './notifications/telegram.js';
import { PredictionDataStream } from './market/predictiondata.js';
import { PolymarketWs } from './market/polymarket.js';
import { EdgeEngine } from './market/edge-engine.js';
import { TradeExecutor } from './chain/executor.js';
import { WalletService } from './chain/wallet.js';
import { ChainMonitor } from './chain/monitor.js';
import { AnalyticsEngine } from './analytics/engine.js';
import { FeedWatchdog } from './utils/feed-watchdog.js';
import { startApi } from './api/server.js';

// NEVER let the process die from unhandled errors
process.on('uncaughtException', (e) => { logger.error({ err: String(e) }, 'uncaughtException (suppressed)'); });
process.on('unhandledRejection', (e) => { logger.warn({ err: String(e) }, 'unhandled rejection (suppressed)'); });

async function main(): Promise<void> {
  const db = new Db(config.db.path);
  const analytics = new AnalyticsEngine(db);
  const executor = new TradeExecutor(db);
  const wallet = new WalletService();
  const prediction = new PredictionDataStream();

  // Feed watchdog — alerts when feeds go stale (120s grace after boot)
  const watchdog = new FeedWatchdog(120_000, 30_000);
  watchdog.register('predictiondata', 'PredictionData (model)');
  watchdog.register('polymarket', 'Polymarket (price)');

  // Wire watchdog touch events from bus
  bus.on('market:model', () => watchdog.touch('predictiondata'));
  bus.on('market:price', () => watchdog.touch('polymarket'));
  watchdog.start();

  // Skip EOA check - Polymarket uses proxy wallets
  const polymarket = new PolymarketWs();

  // EdgeEngine with live wallet balance for accurate Kelly sizing
  new EdgeEngine(() => wallet.getUsdcBalance());

  wireTelegramNotifications();

  if (config.risk.mode === 'edge') {
    bus.on('edge:signal', (signal) => executor.execute(signal));
  }

  bus.on('chain:marketResolved', (r) => {
    try {
      const pos = db.db.prepare('SELECT * FROM positions WHERE market_id=? AND resolved=0').all(r.marketId) as any[];
      for (const p of pos) {
        const won = p.outcome === r.winningOutcome ? 1 : 0;
        db.upsertPosition({ marketId: p.market_id, outcome: p.outcome, size: p.size, avgPrice: p.avg_price, lastPrice: p.last_price, realizedPnl: p.realized_pnl + (won ? p.size * (1 - p.avg_price) : -p.size * p.avg_price), unrealizedPnl: 0, resolved: 1, winner: won });
        db.db.prepare('INSERT INTO redemptions(ts, market_id, amount, tx_hash) VALUES(?,?,?,?)').run(Date.now(), p.market_id, won ? p.size : 0, `auto-${Date.now()}`);
      }
    } catch (e) { logger.error({ err: String(e) }, 'chain:marketResolved handler error'); }
  });

  // Throttle balance recording — at most once per 10s to avoid DB thrash on rapid price ticks
  let lastBalanceRecord = 0;
  bus.on('market:price', async () => {
    if (Date.now() - lastBalanceRecord < 10_000) return;
    lastBalanceRecord = Date.now();
    try {
      const usdc = await wallet.getUsdcBalance().catch(() => 0);
      const exposure = (db.db.prepare('SELECT COALESCE(SUM(size*avg_price),0) as v FROM positions WHERE resolved=0').get() as any).v as number;
      const equity = usdc + exposure;
      db.recordBalance(Date.now(), usdc, exposure, equity);
    } catch (e) { logger.error({ err: String(e) }, 'market:price handler error'); }
  });

  const { server } = startApi(db, analytics, watchdog);

  // Chain monitor DISABLED - Alchemy WSS kills process
  // try {
    // const chain = new ChainMonitor();
    // chain.start();
  // } catch (e) { ... }

  // PredictionData - optional, REST fallback runs regardless
  prediction.start().catch((e) => logger.warn({ err: String(e) }, 'PredictionData SSE failed, REST fallback still active'));

  // Polymarket WS (now async — fetches token IDs before connecting)
  polymarket.start().catch((e) => logger.warn({ err: String(e) }, 'Polymarket WS start failed'));

  logger.info({ port: config.app.port }, 'poly-edge v2 started (crash-proof mode)');

  // Keep alive - heartbeat every 60s
  const healthServer = http.createServer((req, res) => {
    const feedHealth = watchdog.snapshot();
    const allHealthy = Object.values(feedHealth).every((f) => f.healthy);
    res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: allHealthy, ts: Date.now(), feeds: feedHealth }));
  });
  healthServer.listen(8081, () => logger.info('health server on 8081'));
  const keepAlive = setInterval(() => { logger.debug('heartbeat alive'); }, 60_000);
  (keepAlive as any).__noUnref = true;

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'shutting down');
    watchdog.stop();
    prediction.stop();
    polymarket.stop();
    server.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error(e, 'fatal startup error');
  // DON'T exit - try to keep running
  logger.warn('attempting to stay alive despite startup error');
});





