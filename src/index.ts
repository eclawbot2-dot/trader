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
import { startApi } from './api/server.js';

async function main(): Promise<void> {
  const db = new Db(config.db.path);
  const analytics = new AnalyticsEngine(db);
  const executor = new TradeExecutor(db);
  const wallet = new WalletService();
  const chain = new ChainMonitor();
  const prediction = new PredictionDataStream();
  const polymarket = new PolymarketWs();
  new EdgeEngine();
  wireTelegramNotifications();

  bus.on('edge:signal', (signal) => executor.execute(signal));

  bus.on('chain:marketResolved', (r) => {
    const pos = db.db.prepare('SELECT * FROM positions WHERE market_id=? AND resolved=0').all(r.marketId) as any[];
    for (const p of pos) {
      const won = p.outcome === r.winningOutcome ? 1 : 0;
      db.upsertPosition({ marketId: p.market_id, outcome: p.outcome, size: p.size, avgPrice: p.avg_price, lastPrice: p.last_price, realizedPnl: p.realized_pnl + (won ? p.size * (1 - p.avg_price) : -p.size * p.avg_price), unrealizedPnl: 0, resolved: 1, winner: won });
      db.db.prepare('INSERT INTO redemptions(ts, market_id, amount, tx_hash) VALUES(?,?,?,?)').run(Date.now(), p.market_id, won ? p.size : 0, `auto-${Date.now()}`);
    }
  });

  bus.on('market:price', async () => {
    const usdc = await wallet.getUsdcBalance().catch(() => 0);
    const exposure = (db.db.prepare('SELECT COALESCE(SUM(size*avg_price),0) as v FROM positions WHERE resolved=0').get() as any).v as number;
    const equity = usdc + exposure;
    db.recordBalance(Date.now(), usdc, exposure, equity);
  });

  const { server } = startApi(db, analytics);
  chain.start();
  void prediction.start();
  polymarket.start();

  logger.info({ port: config.app.port }, 'poly-edge v2 started');

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'shutting down');
    prediction.stop();
    polymarket.stop();
    await chain.stop();
    server.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error(e, 'fatal');
  bus.emit('system:error', { module: 'bootstrap', error: String(e), ts: Date.now() });
  process.exit(1);
});
