import { rateLimitHit } from '~/server/utils/rateLimiter'

type Rule = { name: string; limit: number; windowMs: number }
const MINUTE = 60_000

// Tighter cap on triage (it creates Linear issues — the most abusable path),
// then the general public board, then the admin login.
function ruleFor(path: string): Rule | null {
  if (path.startsWith('/api/share/') && path.endsWith('/triage')) {
    return { name: 'triage', limit: 10, windowMs: MINUTE }
  }
  if (path.startsWith('/api/share/')) {
    return { name: 'share', limit: 60, windowMs: MINUTE }
  }
  // Tight cap on the admin login: the whole panel is gated by one password, so
  // throttle brute-force attempts hard.
  if (path === '/api/auth/login') {
    return { name: 'login', limit: 10, windowMs: MINUTE }
  }
  if (path.startsWith('/auth/')) {
    return { name: 'auth', limit: 20, windowMs: MINUTE }
  }
  return null
}

export default defineEventHandler((event) => {
  const rule = ruleFor(event.path || '')
  if (!rule) return

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const result = rateLimitHit(`${rule.name}:${ip}`, rule.limit, rule.windowMs, Date.now())

  if (!result.allowed) {
    setResponseHeader(event, 'retry-after', Math.ceil(result.retryAfterMs / 1000))
    throw createError({
      statusCode: 429,
      message: 'Muitas requisições. Tente novamente em instantes.',
    })
  }
})
