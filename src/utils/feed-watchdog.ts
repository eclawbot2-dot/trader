/**
 * Feed liveness watchdog.
 * Fires alerts if no events are received from a feed within the configured grace period.
 */
import { bus } from '../notifications/emitter.js';
import { logger } from './logger.js';

interface FeedState {
  label: string;
  lastEventTs: number;
  healthy: boolean;
}

export class FeedWatchdog {
  private feeds = new Map<string, FeedState>();
  private timer?: NodeJS.Timeout;
  private readonly graceMs: number;
  private readonly checkIntervalMs: number;
  /** Boot time — don't alert until grace period after boot */
  private readonly bootTs = Date.now();

  constructor(graceMs = 120_000, checkIntervalMs = 30_000) {
    this.graceMs = graceMs;
    this.checkIntervalMs = checkIntervalMs;
  }

  /** Register a feed to monitor */
  register(name: string, label: string): void {
    this.feeds.set(name, { label, lastEventTs: 0, healthy: true });
  }

  /** Call this whenever a feed produces an event */
  touch(name: string): void {
    const f = this.feeds.get(name);
    if (f) {
      f.lastEventTs = Date.now();
      if (!f.healthy) {
        f.healthy = true;
        logger.info({ feed: name }, `feed ${name} recovered`);
      }
    }
  }

  /** Start periodic liveness checks */
  start(): void {
    this.timer = setInterval(() => this.check(), this.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private check(): void {
    const now = Date.now();
    // Don't alert during the initial boot grace period
    if (now - this.bootTs < this.graceMs) return;

    for (const [name, f] of this.feeds) {
      const sinceLastEvent = f.lastEventTs > 0 ? now - f.lastEventTs : now - this.bootTs;
      if (sinceLastEvent > this.graceMs && f.healthy) {
        f.healthy = false;
        const staleSecs = Math.round(sinceLastEvent / 1000);
        logger.error({ feed: name, staleSecs }, `feed ${name} stale for ${staleSecs}s`);
        bus.emit('risk:alert', {
          type: 'feed-stale',
          message: `${f.label} feed has not produced events for ${staleSecs}s`,
          value: staleSecs,
          threshold: Math.round(this.graceMs / 1000),
          ts: now,
        });
      }
    }
  }

  /** Snapshot for /health endpoint */
  snapshot(): Record<string, { healthy: boolean; lastEventTs: number; staleSecs: number }> {
    const now = Date.now();
    const result: Record<string, { healthy: boolean; lastEventTs: number; staleSecs: number }> = {};
    for (const [name, f] of this.feeds) {
      result[name] = {
        healthy: f.healthy,
        lastEventTs: f.lastEventTs,
        staleSecs: f.lastEventTs > 0 ? Math.round((now - f.lastEventTs) / 1000) : -1,
      };
    }
    return result;
  }
}
