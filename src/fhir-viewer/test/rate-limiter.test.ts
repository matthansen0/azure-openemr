import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/services/rate-limiter.js';

describe('RateLimiter', () => {
  it('enforces request limit per key in sliding window', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.checkRateLimit('user-1')).toBe(true);
    expect(limiter.checkRateLimit('user-1')).toBe(true);
    expect(limiter.checkRateLimit('user-1')).toBe(false);

    expect(limiter.checkRateLimit('user-2')).toBe(true);
  });
});
