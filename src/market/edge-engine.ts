import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';

interface MktState { price?: number; prob?: number; ts: number }

export class EdgeEngine {
  private state = new Map<string, MktState>();
  private bankroll = 1000;

  constructor() {
    bus.on('market:price', (p) => {
      const key = `${p.marketId}:${p.outcome}`;
      const prev = this.state.get(key) ?? { ts: p.ts };
      prev.price = p.price;
      prev.ts = p.ts;
      this.state.set(key, prev);
      this.evaluate(p.marketId, p.outcome);
    });

    bus.on('market:model', (m) => {
      const key = `${m.marketId}:${m.outcome}`;
      const prev = this.state.get(key) ?? { ts: m.ts };
      prev.prob = m.probability;
      prev.ts = m.ts;
      this.state.set(key, prev);
      this.evaluate(m.marketId, m.outcome);
    });
  }

  private evaluate(marketId: string, outcome: string): void {
    const s = this.state.get(`${marketId}:${outcome}`);
    if (!s?.price || s.prob === undefined) return;
    const marketProb = Math.max(0.0001, Math.min(0.9999, s.price));
    const modelProb = Math.max(0.0001, Math.min(0.9999, s.prob));
    const edge = modelProb - marketProb;
    if (edge < config.risk.edgeThreshold) return;

    const b = (1 / s.price) - 1;
    const kelly = Math.max(0, Math.min(1, ((b * modelProb) - (1 - modelProb)) / b));
    const sizedKelly = kelly * config.risk.kellyFraction;
    const suggestedSize = Math.min(this.bankroll * sizedKelly, config.risk.maxTradeUsd);

    bus.emit('edge:signal', { marketId, outcome, edge, kelly: sizedKelly, suggestedSize, price: s.price, probability: modelProb, ts: Date.now() });
  }
}
