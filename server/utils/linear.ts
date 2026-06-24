import { LinearClient } from '@linear/sdk'
import type { H3Event } from 'h3'

/** Resolves the single instance-wide Linear personal API key. */
export function getLinearApiKey(event?: H3Event): string {
  const key = useRuntimeConfig(event).linearApiKey
  if (!key) {
    throw createError({ statusCode: 500, message: 'LINEAR_API_KEY não configurada' })
  }
  return key
}

/** Builds a Linear client from the personal API key. Personal keys go through
 * `apiKey` (raw Authorization header); passing one as `accessToken` would send a
 * malformed Bearer header. */
export function linearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey })
}
