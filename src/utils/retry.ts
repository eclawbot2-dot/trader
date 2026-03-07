import { logger } from './logger.js';

export async function retry<T>(fn: () => Promise<T>, opts?: { attempts?: number; baseMs?: number; maxMs?: number; factor?: number; onError?: (e: Error, attempt: number) => void; }): Promise<T> {
  const attempts = opts?.attempts ?? 5;
  const baseMs = opts?.baseMs ?? 500;
  const maxMs = opts?.maxMs ?? 10_000;
  const factor = opts?.factor ?? 2;

  let lastError: Error | undefined;
  let i = 0;
  while (true) {
    i++;
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      opts?.onError?.(lastError, i);
      if (i >= attempts) {
        // Don't throw - just warn and keep retrying with max backoff
        logger.warn({ err: lastError.message }, 'retry exhausted configured attempts, continuing with max backoff');
      }
      const waitMs = Math.min(baseMs * factor ** (Math.min(i, 10) - 1), maxMs);
      logger.warn({ err: lastError.message, attempt: i, waitMs }, 'retrying operation');
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
