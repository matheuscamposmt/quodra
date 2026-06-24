import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/** Constant-time password comparison. Returns false if no password is configured. */
export function checkAdminPassword(submitted: string, expected: string): boolean {
  if (!expected) return false
  const a = Buffer.from(submitted)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Gate for owner/admin routes. Throws 401 unless an admin session is present. */
export async function requireAdmin(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  if (!session.user?.admin) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
}
