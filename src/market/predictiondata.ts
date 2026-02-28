import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

export class PredictionDataStream {
  private abort?: AbortController;
  private pollTimer?: NodeJS.Timeout;

  private emitFromPayload(payload: any): number {
    let emitted = 0;

    // Schema A: { markets: [{ fixture_id, side, odds, league, ... }] }
    const marketRows = payload?.markets;
    if (Array.isArray(marketRows)) {
      for (const m of marketRows) {
        const marketId = String(m.fixture_id ?? m.market_id ?? m.id ?? '');
        const odds = Number(m.odds ?? 0);
        const prob = odds > 0 ? 1 / odds : 0;
        if (!marketId || !Number.isFinite(prob) || prob <= 0 || prob >= 1) continue;
        bus.emit('market:model', {
          marketId,
          outcome: String(m.side ?? m.team_id ?? m.team ?? '0'),
          probability: prob,
          league: m.league,
          team: m.side,
          ts: Date.now(),
        });
        emitted++;
      }
      return emitted;
    }

    // Schema B: legacy stream shape with outcomes array
    const marketId = String(payload?.market_id ?? payload?.id ?? payload?.marketId ?? '');
    const outcomes = payload?.outcomes ?? [];
    if (marketId && Array.isArray(outcomes)) {
      for (const o of outcomes) {
        const prob = Number(o.probability ?? o.model_probability ?? o.implied_probability ?? 0);
        if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) continue;
        bus.emit('market:model', {
          marketId,
          outcome: String(o.name ?? o.outcome ?? o.id ?? '0'),
          probability: prob,
          league: payload?.league,
          team: payload?.team,
          ts: Date.now(),
        });
        emitted++;
      }
    }

    return emitted;
  }

  private async restFallbackPoll(): Promise<void> {
    try {
      const url = `${config.market.predictionRest}?league=NCAAB&bet_types=moneyline&periods=FT&book_ids=250`;
      const res = await fetch(url, { headers: { 'X-API-KEY': config.market.predictionApiKey } });
      if (!res.ok) return;
      const data: any = await res.json();
      this.emitFromPayload(data);
    } catch {
      // ignore fallback errors
    }
  }

  async start(): Promise<void> {
    this.abort = new AbortController();

    // Self-heal fallback: poll REST every 30s even if SSE is quiet
    this.pollTimer = setInterval(() => { void this.restFallbackPoll(); }, 30000);
    void this.restFallbackPoll();

    await retry(async () => {
      const res = await fetch(config.market.predictionSse, {
        headers: { 'X-API-KEY': config.market.predictionApiKey, Accept: 'text/event-stream' },
        signal: this.abort?.signal,
      });
      if (!res.ok || !res.body) throw new Error(`PredictionData SSE failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.replace(/^data:\s*/, '');
          try {
            const msg = JSON.parse(payload);
            this.emitFromPayload(msg);
          } catch {
            // ignore malformed
          }
        }
      }
    }, { attempts: 100, baseMs: 1000, maxMs: 30000, onError: (e) => logger.error({ err: e.message }, 'PredictionData reconnect') });
  }

  stop(): void {
    this.abort?.abort();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}
