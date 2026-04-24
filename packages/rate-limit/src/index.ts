/**
 * @usehyper/rate-limit — token-bucket rate limiting.
 *
 * Pluggable store (default: in-memory). Default key extractor uses
 * the X-Forwarded-For / client IP; consumers can override (session id,
 * api key, etc.).
 *
 *   use(rateLimit({ window: "1m", limit: 60 }))
 *
 * Adds standard headers: `RateLimit-Limit`, `RateLimit-Remaining`,
 * `RateLimit-Reset`. Responds 429 with `Retry-After` on exhaustion.
 */

import { HyperError, type HyperPlugin, type Middleware, coerce } from "@usehyper/core"

export interface RateLimitStore {
  take(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
}

export interface RateLimitResult {
  readonly allowed: boolean
  readonly remaining: number
  readonly resetMs: number
}

interface Bucket {
  count: number
  reset: number
}

export function memoryLimiter(): RateLimitStore {
  const buckets = new Map<string, Bucket>()
  return {
    async take(key, limit, windowMs) {
      const now = Date.now()
      let b = buckets.get(key)
      if (!b || b.reset <= now) {
        b = { count: 0, reset: now + windowMs }
        buckets.set(key, b)
      }
      b.count += 1
      const allowed = b.count <= limit
      const remaining = Math.max(0, limit - b.count)
      return { allowed, remaining, resetMs: b.reset - now }
    },
  }
}

export interface RateLimitConfig {
  readonly store?: RateLimitStore
  readonly limit: number
  /** ms or short string ("1m", "10s", "1h"). */
  readonly window: number | string
  readonly key?: (req: Request) => string
}

export function rateLimit(config: RateLimitConfig): Middleware {
  const store = config.store ?? memoryLimiter()
  const windowMs = typeof config.window === "string" ? parseDuration(config.window) : config.window
  const keyFn = config.key ?? defaultKey

  return async ({ req, next }) => {
    const key = keyFn(req)
    const r = await store.take(key, config.limit, windowMs)
    if (!r.allowed) {
      const retryAfter = Math.ceil(r.resetMs / 1000)
      return new Response(JSON.stringify({ error: "rate_limit_exceeded", retryAfter }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": retryAfter.toString(),
          "ratelimit-limit": config.limit.toString(),
          "ratelimit-remaining": "0",
          "ratelimit-reset": retryAfter.toString(),
        },
      })
    }
    const out = await next()
    const res = out instanceof Response ? out : coerce(out)
    res.headers.set("ratelimit-limit", config.limit.toString())
    res.headers.set("ratelimit-remaining", r.remaining.toString())
    res.headers.set("ratelimit-reset", Math.ceil(r.resetMs / 1000).toString())
    return res
  }
}

function defaultKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  )
}

/**
 * Auto-rate-limit plugin for auth endpoints.
 *
 * Any route carrying `meta.authEndpoint === true` gets a default rate
 * limit applied without the author having to chain `.use(rateLimit(...))`
 * on every login/reset/verify handler. Route-level limits still win:
 * if the route declares its own rateLimit middleware, this plugin no-ops.
 *
 *   app({
 *     routes: [loginRoute, resetPasswordRoute],
 *     plugins: [authRateLimitPlugin({ limit: 10, window: "1m" })],
 *   })
 *
 * Default key: caller IP + route path. Credential-stuffing attackers
 * spraying hundreds of accounts from one IP hit the limit immediately.
 */
export interface AuthRateLimitConfig {
  readonly limit?: number
  readonly window?: number | string
  readonly store?: RateLimitStore
  readonly key?: (req: Request) => string
}

const AUTH_STATE = new WeakMap<
  Request,
  { path: string; limit: number; remaining: number; resetMs: number }
>()

export function authRateLimitPlugin(config: AuthRateLimitConfig = {}): HyperPlugin {
  const limit = config.limit ?? 10
  const window = config.window ?? "1m"
  const windowMs = typeof window === "string" ? parseDuration(window) : window
  const store = config.store ?? memoryLimiter()
  const keyFn = config.key ?? defaultKey

  return {
    name: "@usehyper/rate-limit:auth",
    request: {
      async before({ req, route }) {
        if (!route?.meta?.authEndpoint) return
        const key = `auth:${route.path}:${keyFn(req)}`
        const r = await store.take(key, limit, windowMs)
        AUTH_STATE.set(req, { path: route.path, limit, remaining: r.remaining, resetMs: r.resetMs })
        if (!r.allowed) {
          const retryAfter = Math.ceil(r.resetMs / 1000)
          throw new HyperError({
            status: 429,
            code: "rate_limit_exceeded",
            message: "Too many auth attempts. Back off and retry.",
            why: `More than ${limit} auth attempts in the current window.`,
            fix: `Wait ${retryAfter} seconds and retry. Consider adding CAPTCHA or progressive delays on the client.`,
            details: { retryAfter, limit },
          })
        }
      },
      after({ req, res, route }) {
        if (!route?.meta?.authEndpoint) return
        const s = AUTH_STATE.get(req)
        if (!s) return
        AUTH_STATE.delete(req)
        res.headers.set("ratelimit-limit", s.limit.toString())
        res.headers.set("ratelimit-remaining", s.remaining.toString())
        res.headers.set("ratelimit-reset", Math.ceil(s.resetMs / 1000).toString())
      },
    },
  }
}

function parseDuration(s: string): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)$/.exec(s)
  if (!m) throw new Error(`rate-limit: invalid duration "${s}"`)
  const n = Number.parseInt(m[1]!, 10)
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1000
    case "m":
      return n * 60 * 1000
    case "h":
      return n * 60 * 60 * 1000
    case "d":
      return n * 24 * 60 * 60 * 1000
    default:
      throw new Error(`rate-limit: invalid unit "${m[2]}"`)
  }
}
