import { bus } from '../notifications/emitter.js';

export class AlertEngine {
  private lastSent = new Map<string, number>();
  check(type: string, value: number, threshold: number, message: string): void {
    if (value <= threshold) return;
    const now = Date.now();
    const last = this.lastSent.get(type) ?? 0;
    if (now - last < 30_000) return;
    this.lastSent.set(type, now);
    bus.emit('risk:alert', { type, message, value, threshold, ts: now });
  }
}
