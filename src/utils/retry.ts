import { logger } from './logger.js';

export async function retry<T>(fn: () => Promise<T>, opts?: { attempts?: number; baseMs?: number; maxMs?: number; factor?: number; onError?: (e: Error, attempt: number) => void; }): Promise<T> {
  const attempts = opts?.attempts ?? 5;
  const baseMs = opts?.baseMs ?? 500;
  const maxMs = opts?.maxMs ?? 10_000;
  const factor = opts?.factor ?? 2;

  let lastError: Error | undefined;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      opts?.onError?.(lastError, i);
      if (i === attempts) break;
      const waitMs = Math.min(baseMs * factor ** (i - 1), maxMs);
      logger.warn({ err: lastError.message, attempt: i, waitMs }, 'retrying operation');
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError ?? new Error('retry failed');
}
