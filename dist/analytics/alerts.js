import { bus } from '../notifications/emitter.js';
export class AlertEngine {
    lastSent = new Map();
    check(type, value, threshold, message) {
        if (value <= threshold)
            return;
        const now = Date.now();
        const last = this.lastSent.get(type) ?? 0;
        if (now - last < 30_000)
            return;
        this.lastSent.set(type, now);
        bus.emit('risk:alert', { type, message, value, threshold, ts: now });
    }
}
