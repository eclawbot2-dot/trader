import { bus } from '../notifications/emitter.js';
import { sharpe, maxDrawdown } from './metrics.js';
import { TimeSeriesStore } from './timeseries.js';
import { AlertEngine } from './alerts.js';
import { config } from '../config.js';
export class AnalyticsEngine {
    db;
    ts;
    alerts = new AlertEngine();
    equityCurve = [1000];
    returns = [];
    wins = 0;
    losses = 0;
    realized = 0;
    unrealized = 0;
    edgeErrors = [];
    constructor(db) {
        this.db = db;
        this.ts = new TimeSeriesStore(db);
        bus.on('trade:executed', (t) => {
            this.realized += t.edge * t.size;
            if (t.edge > 0)
                this.wins += 1;
            else
                this.losses += 1;
            this.update();
        });
        bus.on('market:price', ({ marketId, outcome, price }) => {
            const pos = this.db.db.prepare('SELECT * FROM positions WHERE market_id=? AND outcome=?').get(marketId, outcome);
            if (!pos || pos.size === 0)
                return;
            const pnl = (price - pos.avg_price) * pos.size;
            this.unrealized += pnl - (pos.unrealized_pnl ?? 0);
            this.db.upsertPosition({ ...pos, marketId, outcome, size: pos.size, avgPrice: pos.avg_price, lastPrice: price, unrealizedPnl: pnl, realizedPnl: pos.realized_pnl ?? 0, resolved: pos.resolved, winner: pos.winner });
            this.update();
        });
        bus.on('edge:signal', (s) => {
            this.db.db.prepare('INSERT INTO edge_observations(ts, market_id, outcome, model_prob, market_prob, edge, slippage) VALUES(?,?,?,?,?,?,?)')
                .run(Date.now(), s.marketId, s.outcome, s.probability, s.price, s.edge, 0);
        });
    }
    update() {
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
    snapshot() {
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
