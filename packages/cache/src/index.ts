/**
 * @usehyper/cache — stale-while-revalidate + ETag + stampede protection.
 *
 * Keyed by method + URL. Only caches GET/HEAD.
 *
 *   fresh (age <= maxAge):       serve from cache (no revalidation)
 *   stale (age <= maxAge+swr):   serve stale + kick off background refresh
 *   dead (older than stale):     synchronous refresh, single-flight locked
 *
 * ETag:
 *   - We auto-generate a weak ETag from the response body (xxhash3 if
 *     available, SHA-1 fallback).
 *   - If `If-None-Match` matches, we return 304.
 */

import { type Middleware, coerce } from "@usehyper/core"

export interface CacheEntry {
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: Uint8Array
  readonly etag: string
  readonly createdAt: number
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined>
  set(key: string, value: CacheEntry): Promise<void>
}

export function memoryCache(): CacheStore {
  const map = new Map<string, CacheEntry>()
  return {
    async get(k) {
      return map.get(k)
    },
    async set(k, v) {
      map.set(k, v)
    },
  }
}

export interface CacheConfig {
  readonly store?: CacheStore
  /** Seconds. */
  readonly maxAge: number
  /** Seconds of stale grace for SWR. */
  readonly staleWhileRevalidate?: number
  readonly methods?: readonly string[]
}

export function cache(config: CacheConfig): Middleware {
  const store = config.store ?? memoryCache()
  const maxAgeMs = config.maxAge * 1000
  const swrMs = (config.staleWhileRevalidate ?? 0) * 1000
  const methods = new Set(config.methods ?? ["GET", "HEAD"])
  const inFlight = new Map<string, Promise<CacheEntry>>()

  return async ({ req, next }) => {
    if (!methods.has(req.method)) return next()
    const key = `${req.method} ${req.url}`
    const now = Date.now()
    const existing = await store.get(key)
    const ifNoneMatch = req.headers.get("if-none-match")

    if (existing) {
      const age = now - existing.createdAt
      const ageSec = Math.floor(age / 1000)
      if (age <= maxAgeMs) {
        if (ifNoneMatch && ifNoneMatch === existing.etag) {
          return notModified(existing.etag)
        }
        return materialize(existing, "fresh", ageSec, maxAgeMs / 1000, swrMs / 1000)
      }
      if (age <= maxAgeMs + swrMs) {
        if (!inFlight.has(key)) {
          inFlight.set(
            key,
            refresh({ next, store, key })
              .catch(() => existing)
              .finally(() => inFlight.delete(key)),
          )
        }
        if (ifNoneMatch && ifNoneMatch === existing.etag) {
          return notModified(existing.etag)
        }
        return materialize(existing, "stale", ageSec, maxAgeMs / 1000, swrMs / 1000)
      }
    }

    let p = inFlight.get(key)
    if (!p) {
      p = refresh({ next, store, key })
      inFlight.set(key, p)
      p.finally(() => inFlight.delete(key))
    }
    const entry = await p
    if (ifNoneMatch && ifNoneMatch === entry.etag) return notModified(entry.etag)
    return materialize(entry, "miss", 0, maxAgeMs / 1000, swrMs / 1000)
  }
}

async function refresh(args: {
  next: () => Promise<unknown>
  store: CacheStore
  key: string
}): Promise<CacheEntry> {
  const out = await args.next()
  const res = out instanceof Response ? out : coerce(out)
  const body = new Uint8Array(await res.clone().arrayBuffer())
  const headers: Record<string, string> = {}
  for (const [k, v] of res.headers) headers[k] = v
  const etag = `W/"${await etagOf(body)}"`
  const entry: CacheEntry = {
    status: res.status,
    headers,
    body,
    etag,
    createdAt: Date.now(),
  }
  if (res.status >= 200 && res.status < 300) await args.store.set(args.key, entry)
  return entry
}

function materialize(
  entry: CacheEntry,
  mode: "fresh" | "stale" | "miss",
  age: number,
  maxAge: number,
  swr: number,
): Response {
  const h = new Headers(entry.headers)
  h.set("etag", entry.etag)
  h.set("age", age.toString())
  h.set("x-cache", mode)
  if (maxAge > 0) {
    h.set(
      "cache-control",
      swr > 0
        ? `public, max-age=${maxAge}, stale-while-revalidate=${swr}`
        : `public, max-age=${maxAge}`,
    )
  }
  return new Response(entry.body, { status: entry.status, headers: h })
}

function notModified(etag: string): Response {
  return new Response(null, { status: 304, headers: { etag } })
}

async function etagOf(buf: Uint8Array): Promise<string> {
  const xx = (Bun as unknown as { hash?: { xxHash3?: (b: Uint8Array) => bigint } }).hash?.xxHash3
  if (xx) return xx(buf).toString(16)
  const d = await crypto.subtle.digest("SHA-1", buf)
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
