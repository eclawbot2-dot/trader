import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

export class PredictionDataStream {
  private abort?: AbortController;

  async start(): Promise<void> {
    this.abort = new AbortController();
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
            const marketId = String(msg.market_id ?? msg.id ?? msg.marketId ?? '');
            const outcomes = msg.outcomes ?? [];
            for (const o of outcomes) {
              bus.emit('market:model', {
                marketId,
                outcome: String(o.name ?? o.outcome ?? o.id ?? '0'),
                probability: Number(o.probability ?? o.model_probability ?? 0),
                league: msg.league,
                team: msg.team,
                ts: Date.now(),
              });
            }
          } catch {
            // ignore malformed
          }
        }
      }
    }, { attempts: 100, baseMs: 1000, maxMs: 30000, onError: (e) => logger.error({ err: e.message }, 'PredictionData reconnect') });
  }

  stop(): void {
    this.abort?.abort();
  }
}
