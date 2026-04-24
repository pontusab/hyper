/**
 * Memory stores — drop-in replacements for the Store shapes that
 * @usehyper/cache, @usehyper/idempotency, @usehyper/rate-limit, @usehyper/session
 * accept. Identical surface, zero persistence, deterministic for tests.
 *
 * These shapes intentionally don't import from the consumer packages —
 * they duplicate the tiny interfaces so `@usehyper/testing` can serve any
 * of them without cyclic deps.
 */

import type { Clock } from "./clock.ts"
import { systemClock } from "./clock.ts"

// Generic KV ------------------------------------------------------------

export interface KvEntry<V> {
  readonly value: V
  readonly expiresAt: number | null
}

export interface KvStore<V> {
  get(key: string): Promise<V | undefined>
  set(key: string, value: V, ttlMs?: number): Promise<void>
  delete(key: string): Promise<void>
}

export function memoryKv<V>(clock: Clock = systemClock): KvStore<V> {
  const map = new Map<string, KvEntry<V>>()
  return {
    async get(key) {
      const e = map.get(key)
      if (!e) return undefined
      if (e.expiresAt !== null && e.expiresAt <= clock.now()) {
        map.delete(key)
        return undefined
      }
      return e.value
    },
    async set(key, value, ttlMs) {
      map.set(key, { value, expiresAt: ttlMs ? clock.now() + ttlMs : null })
    },
    async delete(key) {
      map.delete(key)
    },
  }
}

// Rate limiter ----------------------------------------------------------

export interface RateLimitResult {
  readonly allowed: boolean
  readonly remaining: number
  readonly resetMs: number
}

export interface MemoryRateLimiterOptions {
  readonly limit: number
  readonly windowMs: number
  readonly clock?: Clock
}

export function memoryRateLimiter(opts: MemoryRateLimiterOptions): {
  check: (key: string) => Promise<RateLimitResult>
  reset: (key?: string) => void
} {
  const clock = opts.clock ?? systemClock
  const buckets = new Map<string, { tokens: number; resetAt: number }>()
  return {
    async check(key: string) {
      const now = clock.now()
      let b = buckets.get(key)
      if (!b || b.resetAt <= now) {
        b = { tokens: opts.limit, resetAt: now + opts.windowMs }
        buckets.set(key, b)
      }
      if (b.tokens <= 0) {
        return { allowed: false, remaining: 0, resetMs: b.resetAt - now }
      }
      b.tokens -= 1
      return { allowed: true, remaining: b.tokens, resetMs: b.resetAt - now }
    },
    reset(key) {
      if (key === undefined) buckets.clear()
      else buckets.delete(key)
    },
  }
}

// Tiny in-memory SQL-ish "db" ------------------------------------------

export interface MemoryTable<Row> {
  readonly name: string
  readonly rows: Row[]
  insert(row: Row): Row
  find(predicate: (r: Row) => boolean): Row | undefined
  filter(predicate: (r: Row) => boolean): Row[]
  update(predicate: (r: Row) => boolean, patch: Partial<Row>): Row | undefined
  delete(predicate: (r: Row) => boolean): number
  clear(): void
}

export function memoryTable<Row>(name: string): MemoryTable<Row> {
  const rows: Row[] = []
  return {
    name,
    rows,
    insert(r) {
      rows.push(r)
      return r
    },
    find: (p) => rows.find(p),
    filter: (p) => rows.filter(p),
    update: (p, patch) => {
      const i = rows.findIndex(p)
      if (i < 0) return undefined
      rows[i] = { ...(rows[i] as object), ...(patch as object) } as Row
      return rows[i]
    },
    delete: (p) => {
      const before = rows.length
      for (let i = rows.length - 1; i >= 0; i--) {
        if (p(rows[i] as Row)) rows.splice(i, 1)
      }
      return before - rows.length
    },
    clear() {
      rows.length = 0
    },
  }
}

/**
 * `memoryDb()` — a bag of named tables with helpers. Covers the ~20
 * queries that `apps/examples/todo` exercises. Grows organically.
 */
export interface MemoryDb {
  table<Row>(name: string): MemoryTable<Row>
  reset(): void
}

export function memoryDb(): MemoryDb {
  const tables = new Map<string, MemoryTable<unknown>>()
  return {
    table<Row>(name: string): MemoryTable<Row> {
      let t = tables.get(name) as MemoryTable<Row> | undefined
      if (!t) {
        t = memoryTable<Row>(name)
        tables.set(name, t as MemoryTable<unknown>)
      }
      return t
    },
    reset() {
      for (const t of tables.values()) t.clear()
    },
  }
}
