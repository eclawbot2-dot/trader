/**
 * One-time migration: remove duplicate trades created by v1→v2 migration.
 * Keeps the row with the lowest id for each unique (ts, market_id, outcome, side, price, size, edge, status) combo.
 * Safe to run multiple times — idempotent.
 */
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

export function deduplicateTrades(db: Database.Database): void {
  const countBefore = (db.prepare('SELECT COUNT(*) as c FROM trades').get() as any).c;

  const deleted = db.prepare(`
    DELETE FROM trades WHERE id NOT IN (
      SELECT MIN(id) FROM trades
      GROUP BY ts, market_id, outcome, side, price, size, edge, status
    )
  `).run();

  const countAfter = (db.prepare('SELECT COUNT(*) as c FROM trades').get() as any).c;
  const removed = deleted.changes;

  if (removed > 0) {
    logger.info({ before: countBefore, after: countAfter, removed }, 'dedup migration: removed duplicate trades');
  } else {
    logger.debug('dedup migration: no duplicates found');
  }
}
