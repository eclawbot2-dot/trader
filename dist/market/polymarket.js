import WebSocket from 'ws';
import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';
export class PolymarketWs {
    ws;
    reconnectTimer;
    start() {
        this.ws = new WebSocket(config.market.clobWs);
        this.ws.on('open', () => {
            logger.info('polymarket ws connected');
            this.ws?.send(JSON.stringify({ type: 'subscribe', channel: 'market' }));
            this.ws?.send(JSON.stringify({ type: 'subscribe', channel: 'book' }));
        });
        this.ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                const marketId = String(msg.market_id ?? msg.market ?? msg.asset_id ?? '');
                const outcome = String(msg.outcome ?? msg.token_id ?? msg.side ?? 'YES');
                const price = Number(msg.price ?? msg.best_bid ?? msg.mid ?? msg.last_trade_price ?? 0);
                if (marketId && Number.isFinite(price) && price > 0) {
                    bus.emit('market:price', { marketId, outcome, price, ts: Date.now() });
                }
            }
            catch {
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
    stop() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
    }
}
