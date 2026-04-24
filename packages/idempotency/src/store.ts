/**
 * IdempotencyStore — pluggable cache backend.
 *
 * We ship an in-memory TTL store by default. Production deployments
 * bind a Redis/KeyDB adapter via `.store(...)`.
 */

export interface CachedResponse {
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: string
  readonly createdAt: number
}

export interface IdempotencyStore {
  get(key: string): Promise<CachedResponse | undefined>
  set(key: string, value: CachedResponse, ttlMs: number): Promise<void>
  /** Returns true if the key was *newly* locked. Used for request-in-flight races. */
  lock(key: string, ttlMs: number): Promise<boolean>
  unlock(key: string): Promise<void>
}

export function memoryStore(): IdempotencyStore {
  const data = new Map<string, { value: CachedResponse; expires: number }>()
  const locks = new Map<string, number>()
  const now = () => Date.now()
  return {
    async get(key) {
      const v = data.get(key)
      if (!v) return undefined
      if (v.expires < now()) {
        data.delete(key)
        return undefined
      }
      return v.value
    },
    async set(key, value, ttlMs) {
      data.set(key, { value, expires: now() + ttlMs })
    },
    async lock(key, ttlMs) {
      const existing = locks.get(key)
      if (existing && existing >= now()) return false
      locks.set(key, now() + ttlMs)
      return true
    },
    async unlock(key) {
      locks.delete(key)
    },
  }
}
