export class CircuitBreaker {
    threshold;
    cooldownMs;
    failures = 0;
    openedAt = 0;
    constructor(threshold = 5, cooldownMs = 30_000) {
        this.threshold = threshold;
        this.cooldownMs = cooldownMs;
    }
    canExecute() {
        if (this.failures < this.threshold)
            return true;
        return Date.now() - this.openedAt > this.cooldownMs;
    }
    onSuccess() {
        this.failures = 0;
        this.openedAt = 0;
    }
    onFailure() {
        this.failures += 1;
        if (this.failures >= this.threshold && this.openedAt === 0) {
            this.openedAt = Date.now();
        }
    }
    state() {
        if (this.failures < this.threshold)
            return 'CLOSED';
        if (Date.now() - this.openedAt > this.cooldownMs)
            return 'HALF_OPEN';
        return 'OPEN';
    }
}
