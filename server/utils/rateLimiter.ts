// In-memory fixed-window limiter. `now` is passed in so the logic is pure and
// unit-testable without mocking the clock. MVP scope: per-instance only (a
// single instance); move to Postgres/Redis if we scale horizontally.

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number }

export function rateLimitHit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): RateLimitResult {
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }
  bucket.count++
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}

/** Test-only: clear all buckets. */
export function _resetRateLimiter(): void {
  buckets.clear()
}
