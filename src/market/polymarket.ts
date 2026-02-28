import WebSocket from 'ws';
import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';

export class PolymarketWs {
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;

  start(): void {
    this.ws = new WebSocket(config.market.clobWs);

    this.ws.on('open', () => {
      logger.info('polymarket ws connected');
      // Correct CLOB market-channel subscription format
      this.ws?.send(JSON.stringify({
        type: 'market',
        assets_ids: [],
        custom_feature_enabled: true,
      }));
    });

    this.ws.on('message', (raw) => {
      const text = raw.toString();
      if (text.includes('INVALID OPERATION')) {
        logger.error({ msg: text }, 'polymarket ws invalid subscription operation');
        // Fallback attempt with alternate field name used by some ws versions
        this.ws?.send(JSON.stringify({ type: 'market', asset_ids: [], custom_feature_enabled: true }));
        return;
      }

      try {
        const msg: any = JSON.parse(text);
        const marketId = String(msg.market_id ?? msg.market ?? msg.asset_id ?? '');
        const outcome = String(msg.outcome ?? msg.token_id ?? msg.side ?? 'YES');
        const price = Number(msg.price ?? msg.best_bid ?? msg.mid ?? msg.last_trade_price ?? msg?.price_changes?.[0]?.price ?? 0);
        if (marketId && Number.isFinite(price) && price > 0) {
          bus.emit('market:price', { marketId, outcome, price, ts: Date.now() });
        }
      } catch {
        // ignore
      }
    });

    this.ws.on('close', () => {
      logger.warn('polymarket ws closed; reconnecting');
      this.reconnectTimer = setTimeout(() => this.start(), 3000);
    });

    this.ws.on('error', (err) => {
      logger.error({ err: String(err) }, 'polymarket ws error');
      bus.emit('system:error', { module: 'polymarket-ws', error: String(err), ts: Date.now() });
    });
  }

  stop(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
