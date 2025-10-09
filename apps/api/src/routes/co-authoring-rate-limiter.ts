export interface SessionRateLimiterOptions {
  windowMs: number;
  maxRequestsPerWindow: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface CheckOptions {
  now?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class SessionRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly options: SessionRateLimiterOptions) {}

  check(key: string, options: CheckOptions = {}): RateLimitCheckResult {
    const now = options.now ?? Date.now();
    this.prune({ now });

    let entry = this.entries.get(key);

    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.options.windowMs,
      } satisfies RateLimitEntry;
      this.entries.set(key, entry);
    }

    if (entry.count >= this.options.maxRequestsPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, entry.resetTime - now),
      } satisfies RateLimitCheckResult;
    }

    entry.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, this.options.maxRequestsPerWindow - entry.count),
      retryAfterMs: Math.max(0, entry.resetTime - now),
    } satisfies RateLimitCheckResult;
  }

  prune(options: CheckOptions = {}): void {
    const now = options.now ?? Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now >= entry.resetTime) {
        this.entries.delete(key);
      }
    }
  }

  size(): number {
    return this.entries.size;
  }
}
