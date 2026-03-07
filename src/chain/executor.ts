import { bus } from '../notifications/emitter.js';
import { Db } from '../db/queries.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';

export class TradeExecutor {
  private readonly breaker = new CircuitBreaker(5, 30_000);

  constructor(private readonly db: Db) {}

  execute(signal: { marketId: string; outcome: string; edge: number; kelly: number; suggestedSize: number; price: number; probability: number; ts: number }): void {
    // Circuit breaker — stop trading if too many consecutive failures
    if (!this.breaker.canExecute()) {
      logger.warn({ state: this.breaker.state() }, 'trade executor circuit breaker OPEN — skipping trade');
      return;
    }

    const size = Math.min(signal.suggestedSize, config.risk.maxTradeUsd);
    if (size <= 0) return;

    // Check total portfolio exposure before executing
    const currentExposure = (this.db.db.prepare('SELECT COALESCE(SUM(size*avg_price),0) as v FROM positions WHERE resolved=0').get() as any).v as number;
    if (currentExposure + size > config.risk.maxExposureUsd) {
      logger.warn({ currentExposure, tradeSize: size, maxExposure: config.risk.maxExposureUsd }, 'trade rejected — would exceed max exposure');
      bus.emit('risk:alert', { type: 'exposure-limit', message: `Trade rejected: exposure ${currentExposure.toFixed(2)} + ${size.toFixed(2)} > max ${config.risk.maxExposureUsd}`, value: currentExposure + size, threshold: config.risk.maxExposureUsd, ts: Date.now() });
      return;
    }

    try {
      const trade = {
        ts: Date.now(),
        marketId: signal.marketId,
        outcome: signal.outcome,
        side: 'BUY' as const,
        price: signal.price,
        size,
        edge: signal.edge,
        kelly: signal.kelly,
        expectedValue: signal.edge * size,
        status: 'SIMULATED_FILLED',
        meta: { probability: signal.probability },
      };

      this.db.insertTrade(trade);
      const existing = this.db.db.prepare('SELECT * FROM positions WHERE market_id=? AND outcome=?').get(signal.marketId, signal.outcome) as any;
      const newSize = (existing?.size ?? 0) + size;
      const avgPrice = existing ? ((existing.avg_price * existing.size) + (signal.price * size)) / newSize : signal.price;
      this.db.upsertPosition({ marketId: signal.marketId, outcome: signal.outcome, size: newSize, avgPrice, lastPrice: signal.price });

      this.breaker.onSuccess();
      bus.emit('trade:executed', { ...trade, ts: trade.ts });
    } catch (e) {
      this.breaker.onFailure();
      logger.error({ err: String(e), marketId: signal.marketId }, 'trade execution failed');
      bus.emit('system:error', { module: 'trade-executor', error: String(e), ts: Date.now() });
    }
  }
}
