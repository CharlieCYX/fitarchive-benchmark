/**
 * Rate limiting (Build Bible §15.1 — rate limits on auth/search/AI/events).
 * Pure, in-memory sliding-window limiter. Per-process: a serverless deploy
 * limits per instance, which is honest best-effort for the benchmark (see
 * KNOWN_LIMITATIONS). Unit-tested.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest hit leaves the window (0 when allowed). */
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  function check(key: string, now: number = Date.now()): RateLimitResult {
    const windowStart = now - opts.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= opts.limit) {
      hits.set(key, recent);
      return {
        allowed: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((recent[0] + opts.windowMs - now) / 1000),
        ),
      };
    }
    recent.push(now);
    hits.set(key, recent);
    return { allowed: true, retryAfterSec: 0 };
  }

  return { check };
}
