import { bus } from '../notifications/emitter.js';
import { Db } from '../db/queries.js';
import { config } from '../config.js';

export class TradeExecutor {
  constructor(private readonly db: Db) {}

  execute(signal: { marketId: string; outcome: string; edge: number; kelly: number; suggestedSize: number; price: number; probability: number; ts: number }): void {
    const size = Math.min(signal.suggestedSize, config.risk.maxTradeUsd);
    if (size <= 0) return;

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

    bus.emit('trade:executed', { ...trade, ts: trade.ts });
  }
}
