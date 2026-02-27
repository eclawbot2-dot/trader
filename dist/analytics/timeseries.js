export class TimeSeriesStore {
    db;
    constructor(db) {
        this.db = db;
    }
    push(metric, value, tags) {
        this.db.insertTimeSeries(Date.now(), metric, value, tags);
    }
    get(metric, limit = 500) {
        return this.db.getTimeSeries(metric, limit);
    }
}
