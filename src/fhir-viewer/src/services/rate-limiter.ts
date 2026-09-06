export class RateLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(
    private readonly limit: number = 30,
    private readonly windowMs: number = 60_000
  ) {}

  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const timestamps = this.windows.get(key) ?? [];
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    if (validTimestamps.length >= this.limit) {
      return false;
    }

    validTimestamps.push(now);
    this.windows.set(key, validTimestamps);
    return true;
  }
}
