import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimitHit, _resetRateLimiter } from '../server/utils/rateLimiter'

beforeEach(() => _resetRateLimiter())

describe('rateLimitHit', () => {
  it('allows requests up to the limit', () => {
    const t = 1_000_000
    expect(rateLimitHit('k', 3, 60_000, t).allowed).toBe(true)
    expect(rateLimitHit('k', 3, 60_000, t).allowed).toBe(true)
    expect(rateLimitHit('k', 3, 60_000, t).allowed).toBe(true)
  })

  it('blocks the request that exceeds the limit', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) rateLimitHit('k', 3, 60_000, t)
    const blocked = rateLimitHit('k', 3, 60_000, t)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) rateLimitHit('k', 3, 60_000, t)
    expect(rateLimitHit('k', 3, 60_000, t).allowed).toBe(false)
    // jump past the window
    expect(rateLimitHit('k', 3, 60_000, t + 60_001).allowed).toBe(true)
  })

  it('tracks distinct keys independently', () => {
    const t = 1_000_000
    for (let i = 0; i < 3; i++) rateLimitHit('a', 3, 60_000, t)
    expect(rateLimitHit('a', 3, 60_000, t).allowed).toBe(false)
    expect(rateLimitHit('b', 3, 60_000, t).allowed).toBe(true)
  })
})
