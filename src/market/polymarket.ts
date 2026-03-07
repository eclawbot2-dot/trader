import WebSocket from 'ws';
import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';

/**
 * Fetches active CLOB market token IDs so we can subscribe to specific assets
 * instead of sending an empty array (which produces no events).
 */
async function fetchActiveTokenIds(): Promise<string[]> {
  try {
    // Polymarket CLOB REST — get markets that are currently active/tradeable
    const res = await fetch(`${config.market.clobRest}/markets?active=true&limit=100`);
    if (!res.ok) {
      logger.warn({ status: res.status }, 'failed to fetch active CLOB markets');
      return [];
    }
    const markets: any[] = await res.json() as any[];
    const ids: string[] = [];
    for (const m of markets) {
      // Each market has tokens array with token_id fields
      if (Array.isArray(m.tokens)) {
        for (const tok of m.tokens) {
          if (tok.token_id) ids.push(String(tok.token_id));
        }
      }
      // Fallback: condition_id
      if (m.condition_id) ids.push(String(m.condition_id));
    }
    logger.info({ count: ids.length }, 'fetched active polymarket token IDs');
    return ids;
  } catch (e) {
    logger.error({ err: String(e) }, 'fetchActiveTokenIds failed');
    return [];
  }
}

export class PolymarketWs {
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private refreshTimer?: NodeJS.Timeout;
  private subscribedIds: string[] = [];

  async start(): Promise<void> {
    // Fetch token IDs before connecting so we subscribe to real assets
    this.subscribedIds = await fetchActiveTokenIds();
    this.connect();

    // Refresh token IDs every 5 minutes and re-subscribe if new ones appear
    this.refreshTimer = setInterval(async () => {
      try {
        const fresh = await fetchActiveTokenIds();
        const newIds = fresh.filter((id) => !this.subscribedIds.includes(id));
        if (newIds.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          logger.info({ newIds: newIds.length }, 'subscribing to new polymarket tokens');
          this.ws.send(JSON.stringify({ type: 'market', assets_ids: newIds }));
          this.subscribedIds = [...new Set([...this.subscribedIds, ...newIds])];
        }
      } catch (e) {
        logger.warn({ err: String(e) }, 'polymarket token refresh failed');
      }
    }, 5 * 60 * 1000);
  }

  private connect(): void {
    this.ws = new WebSocket(config.market.clobWs);

    this.ws.on('open', () => {
      logger.info({ tokenCount: this.subscribedIds.length }, 'polymarket ws connected');
      if (this.subscribedIds.length > 0) {
        // Subscribe in batches of 50 to avoid oversized frames
        for (let i = 0; i < this.subscribedIds.length; i += 50) {
          const batch = this.subscribedIds.slice(i, i + 50);
          this.ws?.send(JSON.stringify({ type: 'market', assets_ids: batch }));
        }
      } else {
        logger.warn('no token IDs available — polymarket price feed will be empty');
      }
    });

    this.ws.on('message', (raw) => {
      const text = raw.toString();
      if (text.includes('INVALID OPERATION')) {
        logger.error({ msg: text }, 'polymarket ws invalid subscription operation');
        return;
      }

      try {
        const msgs: any[] = Array.isArray(JSON.parse(text)) ? JSON.parse(text) : [JSON.parse(text)];
        for (const msg of msgs) {
          const marketId = String(msg.market ?? msg.market_id ?? msg.asset_id ?? msg.condition_id ?? '');
          const outcome = String(msg.outcome ?? msg.token_id ?? msg.asset_id ?? msg.side ?? 'YES');
          const price = Number(msg.price ?? msg.best_bid ?? msg.mid ?? msg.last_trade_price ?? msg?.price_changes?.[0]?.price ?? 0);
          if (marketId && Number.isFinite(price) && price > 0 && price < 10) {
            bus.emit('market:price', { marketId, outcome, price, ts: Date.now() });
          }
        }
      } catch {
        // ignore unparseable frames
      }
    });

    this.ws.on('close', () => {
      logger.warn('polymarket ws closed; reconnecting in 3s');
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    });

    this.ws.on('error', (err) => {
      logger.error({ err: String(err) }, 'polymarket ws error');
      bus.emit('system:error', { module: 'polymarket-ws', error: String(err), ts: Date.now() });
    });
  }

  stop(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.ws?.close();
  }
}
