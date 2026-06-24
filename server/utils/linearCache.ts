type CacheEntry = { value: unknown; expiresAt: number }

const store = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 5 * 60 * 1000

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value as T
}

export function setCached(key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function clearCache(): void {
  store.clear()
}
