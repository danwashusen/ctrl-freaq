import { describe, expect, it } from 'vitest';

import { SessionRateLimiter } from './co-authoring-rate-limiter';

describe('SessionRateLimiter', () => {
  it('evicts expired entries when window resets', () => {
    const windowMs = 60_000;
    const limiter = new SessionRateLimiter({
      windowMs,
      maxRequestsPerWindow: 5,
    });

    const key = 'user:doc:sec:intent';
    for (let index = 0; index < 5; index += 1) {
      const result = limiter.check(key, { now: 1_000 + index * 500 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    }

    expect(limiter.size()).toBe(1);

    const denied = limiter.check(key, { now: 5_000 });
    expect(denied.allowed).toBe(false);

    const afterWindow = limiter.check(key, { now: 62_000 });
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(4);
    expect(limiter.size()).toBe(1);

    limiter.prune({ now: 180_000 });
    expect(limiter.size()).toBe(0);
  });

  it('caps map growth for high cardinality usage', () => {
    const limiter = new SessionRateLimiter({ windowMs: 10_000, maxRequestsPerWindow: 2 });

    for (let userIndex = 0; userIndex < 100; userIndex += 1) {
      const key = `user-${userIndex}:doc:sec:intent`;
      limiter.check(key, { now: 1_000 });
    }

    expect(limiter.size()).toBe(100);

    limiter.prune({ now: 20_000 });

    expect(limiter.size()).toBe(0);
  });
});
