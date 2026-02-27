import { Db } from '../db/queries.js';

export class TimeSeriesStore {
  constructor(private readonly db: Db) {}

  push(metric: string, value: number, tags?: Record<string, unknown>): void {
    this.db.insertTimeSeries(Date.now(), metric, value, tags);
  }

  get(metric: string, limit = 500): unknown[] {
    return this.db.getTimeSeries(metric, limit);
  }
}
