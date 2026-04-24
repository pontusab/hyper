/**
 * @usehyper/idempotency — Idempotency-Key middleware.
 *
 * RFC-aligned behavior:
 *   - If request has `Idempotency-Key`, we hash (key + method + path + body)
 *     and cache the response for `ttlMs`.
 *   - Replays within the TTL return the cached response (with
 *     `Idempotent-Replayed: true` header).
 *   - Concurrent requests for the same key serialize via a short lock.
 *
 * This keeps consumers safe from retried PUT/POSTs at the edge.
 */

import { type Middleware, coerce } from "@usehyper/core"
import { type IdempotencyStore, memoryStore } from "./store.ts"

export { memoryStore } from "./store.ts"
export type { CachedResponse, IdempotencyStore } from "./store.ts"

export interface IdempotencyConfig {
  readonly store?: IdempotencyStore
  /** Default: 24h. */
  readonly ttlMs?: number
  /** Default: ["POST", "PUT", "PATCH", "DELETE"]. */
  readonly methods?: readonly string[]
}

const DEFAULT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const DAY = 24 * 60 * 60 * 1000

export function idempotency(config: IdempotencyConfig = {}): Middleware {
  const store = config.store ?? memoryStore()
  const ttl = config.ttlMs ?? DAY
  const methods = new Set(config.methods ?? [...DEFAULT_METHODS])

  return async ({ req, path, next }) => {
    if (!methods.has(req.method)) return next()
    const key = req.headers.get("idempotency-key")
    if (!key) return next()
    const cacheKey = await hash(`${key}|${req.method}|${path}|${await peekBody(req)}`)

    const cached = await store.get(cacheKey)
    if (cached) return replay(cached)

    const locked = await store.lock(cacheKey, 30_000)
    if (!locked) {
      // Another in-flight request holds this key — conservative: 409.
      return new Response(JSON.stringify({ error: "idempotency_in_flight", idempotencyKey: key }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    }

    try {
      const out = await next()
      const res = out instanceof Response ? out : coerce(out)
      const body = await res.clone().text()
      const headers: Record<string, string> = {}
      for (const [k, v] of res.headers) headers[k] = v
      await store.set(cacheKey, { status: res.status, headers, body, createdAt: Date.now() }, ttl)
      return res
    } finally {
      await store.unlock(cacheKey)
    }
  }
}

function replay(c: {
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: string
}) {
  const h = new Headers(c.headers)
  h.set("idempotent-replayed", "true")
  return new Response(c.body, { status: c.status, headers: h })
}

async function peekBody(req: Request): Promise<string> {
  if (!req.body) return ""
  // Hash-only peek — we deliberately consume into a cloned Request so
  // downstream handlers still see the original stream.
  try {
    return await req.clone().text()
  } catch {
    return ""
  }
}

async function hash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s)
  const digest = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
