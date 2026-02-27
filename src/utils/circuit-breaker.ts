export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  canExecute(): boolean {
    if (this.failures < this.threshold) return true;
    return Date.now() - this.openedAt > this.cooldownMs;
  }

  onSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold && this.openedAt === 0) {
      this.openedAt = Date.now();
    }
  }

  state(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (this.failures < this.threshold) return 'CLOSED';
    if (Date.now() - this.openedAt > this.cooldownMs) return 'HALF_OPEN';
    return 'OPEN';
  }
}
