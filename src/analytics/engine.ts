import { Db } from '../db/queries.js';
import { bus } from '../notifications/emitter.js';
import { sharpe, maxDrawdown } from './metrics.js';
import { TimeSeriesStore } from './timeseries.js';
import { AlertEngine } from './alerts.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class AnalyticsEngine {
  private readonly ts: TimeSeriesStore;
  private readonly alerts = new AlertEngine();
  private equityCurve: number[] = [1000];
  private returns: number[] = [];
  private wins = 0;
  private losses = 0;
  private realized = 0;
  private unrealized = 0;
  private edgeErrors: number[] = [];

  constructor(private readonly db: Db) {
    this.ts = new TimeSeriesStore(db);
    this.bootstrap();
    bus.on('trade:executed', (t) => {
      this.realized += t.edge * t.size;
      if (t.edge > 0) this.wins += 1; else this.losses += 1;
      this.update();
    });

    bus.on('market:price', ({ marketId, outcome, price }) => {
      const pos = this.db.db.prepare('SELECT * FROM positions WHERE market_id=? AND outcome=?').get(marketId, outcome) as any;
      if (!pos || pos.size === 0) return;
      const pnl = (price - pos.avg_price) * pos.size;
      // Update position in DB
      this.db.upsertPosition({ ...pos, marketId, outcome, size: pos.size, avgPrice: pos.avg_price, lastPrice: price, unrealizedPnl: pnl, realizedPnl: pos.realized_pnl ?? 0, resolved: pos.resolved, winner: pos.winner });
      // Recompute total unrealized from DB to avoid additive drift
      this.recomputeUnrealized();
      this.update();
    });

    bus.on('edge:signal', (s) => {
      this.db.db.prepare('INSERT INTO edge_observations(ts, market_id, outcome, model_prob, market_prob, edge, slippage) VALUES(?,?,?,?,?,?,?)')
        .run(Date.now(), s.marketId, s.outcome, s.probability, s.price, s.edge, 0);
    });
  }

  /** Recompute total unrealized P&L from DB source of truth (no additive drift) */
  private recomputeUnrealized(): void {
    const row = this.db.db.prepare('SELECT COALESCE(SUM(unrealized_pnl),0) as total FROM positions WHERE resolved=0').get() as any;
    this.unrealized = row?.total ?? 0;
  }

  private bootstrap(): void {
    // Load historical trades to compute realized P&L, wins, losses
    // Edge is stored as decimal (e.g. 0.05 = 5%), same as live path uses (edge * size)
    const trades = this.db.db.prepare('SELECT * FROM trades ORDER BY ts ASC').all() as any[];
    for (const t of trades) {
      const edge = t.edge ?? 0;
      const size = t.size ?? 0;
      if (t.status === 'matched' || t.status === 'MATCHED' || t.status === 'filled' || t.status === 'delayed') {
        this.realized += edge * size; // edge is decimal, consistent with live path
        if (edge > 0) this.wins++; else this.losses++;
        const equity = 1000 + this.realized + this.unrealized;
        this.equityCurve.push(equity);
        const prev = this.equityCurve[this.equityCurve.length - 2] ?? 1000;
        const ret = prev > 0 ? (equity - prev) / prev : 0;
        this.returns.push(ret);
      }
    }

    // Load positions for unrealized P&L — single source of truth from DB
    this.recomputeUnrealized();

    // Load redemptions into realized
    const redemptions = this.db.db.prepare('SELECT SUM(amount) as total FROM redemptions').get() as any;
    if (redemptions?.total) {
      // Already accounted in trades, just note it
    }

    logger.info({ trades: trades.length, wins: this.wins, losses: this.losses, realized: this.realized, unrealized: this.unrealized }, 'analytics bootstrapped');
  }

  private update(): void {
    const equity = 1000 + this.realized + this.unrealized;
    const prev = this.equityCurve[this.equityCurve.length - 1] ?? 1000;
    const ret = prev > 0 ? (equity - prev) / prev : 0;
    this.equityCurve.push(equity);
    this.returns.push(ret);
    this.ts.push('equity', equity);
    this.ts.push('drawdown', maxDrawdown(this.equityCurve));

    const dd = maxDrawdown(this.equityCurve);
    this.alerts.check('drawdown', dd, config.risk.drawdownAlert, 'Portfolio drawdown exceeded threshold');
  }

  snapshot(): Record<string, unknown> {
    const totalTrades = this.wins + this.losses;
    const roi = (this.realized + this.unrealized) / 1000;
    return {
      pnl: {
        realized: this.realized,
        unrealized: this.unrealized,
        total: this.realized + this.unrealized,
      },
      winRate: totalTrades ? this.wins / totalTrades : 0,
      roi,
      sharpe: sharpe(this.returns),
      maxDrawdown: maxDrawdown(this.equityCurve),
      edgeAccuracy: this.edgeErrors.length ? 1 - (this.edgeErrors.reduce((a, b) => a + b, 0) / this.edgeErrors.length) : 0,
      exposure: this.db.db.prepare('SELECT COALESCE(SUM(size*avg_price),0) as v FROM positions WHERE resolved=0').get(),
      efficiency: {
        avgSlippage: this.db.db.prepare('SELECT COALESCE(AVG(slippage),0) as v FROM edge_observations').get(),
        edgeDecay: this.db.db.prepare('SELECT COALESCE(AVG(ABS(edge)),0) as v FROM edge_observations').get(),
      },
    };
  }
}
