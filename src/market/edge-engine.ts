import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';

interface MktState { price?: number; prob?: number; ts: number }

export class EdgeEngine {
  private state = new Map<string, MktState>();
  private bankroll = 1000; // default, updated from live wallet balance
  private lastBankrollRefresh = 0;

  constructor(private readonly walletBalanceFn?: () => Promise<number>) {
    bus.on('market:price', (p) => {
      const key = `${p.marketId}:${p.outcome}`;
      const prev = this.state.get(key) ?? { ts: p.ts };
      prev.price = p.price;
      prev.ts = p.ts;
      this.state.set(key, prev);
      void this.evaluate(p.marketId, p.outcome);
    });

    bus.on('market:model', (m) => {
      const key = `${m.marketId}:${m.outcome}`;
      const prev = this.state.get(key) ?? { ts: m.ts };
      prev.prob = m.probability;
      prev.ts = m.ts;
      this.state.set(key, prev);
      void this.evaluate(m.marketId, m.outcome);
    });
  }

  /** Refresh bankroll from live wallet balance (cached 60s to avoid RPC spam) */
  private async refreshBankroll(): Promise<void> {
    if (!this.walletBalanceFn) return;
    if (Date.now() - this.lastBankrollRefresh < 60_000) return;
    try {
      const bal = await this.walletBalanceFn();
      if (Number.isFinite(bal) && bal > 0) {
        this.bankroll = bal;
        this.lastBankrollRefresh = Date.now();
      }
    } catch (e) {
      logger.warn({ err: String(e) }, 'failed to refresh bankroll from wallet');
    }
  }

  private async evaluate(marketId: string, outcome: string): Promise<void> {
    const s = this.state.get(`${marketId}:${outcome}`);
    if (!s?.price || s.prob === undefined) return;
    const marketProb = Math.max(0.0001, Math.min(0.9999, s.price));
    const modelProb = Math.max(0.0001, Math.min(0.9999, s.prob));
    const edge = modelProb - marketProb;
    if (edge < config.risk.edgeThreshold) return;

    // Refresh bankroll from live wallet balance before sizing
    await this.refreshBankroll();

    const b = (1 / s.price) - 1;
    const kelly = Math.max(0, Math.min(1, ((b * modelProb) - (1 - modelProb)) / b));
    const sizedKelly = kelly * config.risk.kellyFraction;
    const suggestedSize = Math.min(this.bankroll * sizedKelly, config.risk.maxTradeUsd);

    bus.emit('edge:signal', { marketId, outcome, edge, kelly: sizedKelly, suggestedSize, price: s.price, probability: modelProb, ts: Date.now() });
  }
}
