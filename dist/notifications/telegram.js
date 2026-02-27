import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { bus } from './emitter.js';
import { retry } from '../utils/retry.js';
async function sendTelegram(text) {
    if (!config.telegram.botToken || !config.telegram.chatId)
        return;
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    await retry(async () => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: config.telegram.chatId, text, disable_web_page_preview: true }),
        });
        if (!res.ok)
            throw new Error(`telegram error ${res.status}`);
    }, { attempts: 4, baseMs: 400 });
}
export function wireTelegramNotifications() {
    bus.on('trade:executed', (t) => {
        void sendTelegram(`✅ Trade ${t.side} ${t.outcome} ${t.marketId}\nsize=${t.size.toFixed(2)} @ ${t.price.toFixed(4)}\nedge=${(t.edge * 100).toFixed(2)}% kelly=${(t.kelly * 100).toFixed(2)}%`).catch((e) => logger.error(e));
    });
    bus.on('risk:alert', (a) => {
        void sendTelegram(`⚠️ Risk Alert [${a.type}] ${a.message}\nvalue=${a.value.toFixed(4)} threshold=${a.threshold.toFixed(4)}`).catch((e) => logger.error(e));
    });
    bus.on('system:error', (s) => {
        void sendTelegram(`🛑 System Error [${s.module}] ${s.error}`).catch((e) => logger.error(e));
    });
}
