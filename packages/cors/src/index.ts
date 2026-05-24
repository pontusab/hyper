/**
 * @hyper/cors — strict, zero-config-wins CORS for Hyper.
 *
 * Secure by default:
 *   - origins MUST be a list or a callback; wildcard "*" is refused when
 *     credentials are on.
 *   - vary: Origin is always set.
 *   - Preflight answered via plugin pre-hook (short-circuits route match).
 *
 * Usage:
 *   app({ plugins: [corsPlugin({ origin: ["https://app.example.com"] })] })
 */

import type { HyperPlugin } from "@hyper/core"

export interface CorsConfig {
  readonly origin: readonly string[] | ((origin: string) => boolean) | "*"
  readonly methods?: readonly string[]
  readonly headers?: readonly string[]
  readonly credentials?: boolean
  readonly exposeHeaders?: readonly string[]
  readonly maxAge?: number
  /**
   * Opt out of the wildcard-origin hard error. Off by default.
   *
   * Passing `origin: "*"` without this flag is rejected at boot because
   * wildcard CORS effectively disables the Same-Origin Policy for your
   * API — any site on the internet can read it. If you really want that,
   * set `allowAnyOrigin: true` to acknowledge the risk.
   */
  readonly allowAnyOrigin?: boolean
}

const DEFAULT_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const
const DEFAULT_HEADERS = ["content-type", "authorization", "x-request-id"] as const

function assertValid(config: CorsConfig): void {
  if (config.credentials && config.origin === "*") {
    throw new Error(
      "cors: credentials=true is incompatible with origin='*'. " +
        "Why: browsers refuse to send credentials to wildcard origins; this configuration never works. " +
        "Fix: list the exact origins you trust in `origin: [...]`.",
    )
  }
  if (config.origin === "*" && !config.allowAnyOrigin) {
    throw new Error(
      "cors: origin='*' is refused by default. " +
        "Why: wildcard CORS lets every site on the internet read responses from your API. " +
        "Fix: pass an explicit allow-list (`origin: ['https://app.example.com']`) or a predicate " +
        "(`origin: (o) => o.endsWith('.example.com')`). If you really want public read access " +
        "(public docs, OSS metrics, etc.), set `allowAnyOrigin: true` to acknowledge the risk.",
    )
  }
}

function resolveOrigin(config: CorsConfig, origin: string): string | null {
  if (config.origin === "*") return "*"
  if (typeof config.origin === "function") return config.origin(origin) ? origin : null
  return config.origin.includes(origin) ? origin : null
}

export function corsPlugin(config: CorsConfig): HyperPlugin {
  assertValid(config)
  const allowMethods = (config.methods ?? DEFAULT_METHODS).join(", ")
  const allowHeaders = (config.headers ?? DEFAULT_HEADERS).join(", ")
  const exposeHeaders = config.exposeHeaders?.join(", ")
  const maxAge = (config.maxAge ?? 600).toString()
  return {
    name: "@hyper/cors",
    request: {
      preRoute({ req }) {
        if (req.method !== "OPTIONS" || !req.headers.has("access-control-request-method")) {
          return
        }
        const origin = req.headers.get("origin") ?? ""
        const allowed = origin ? resolveOrigin(config, origin) : null
        const headers = new Headers({ vary: "Origin, Access-Control-Request-Headers" })
        if (allowed) {
          headers.set("access-control-allow-origin", allowed)
          headers.set("access-control-allow-methods", allowMethods)
          headers.set("access-control-allow-headers", allowHeaders)
          headers.set("access-control-max-age", maxAge)
          if (config.credentials) headers.set("access-control-allow-credentials", "true")
        }
        return new Response(null, { status: 204, headers })
      },
      after({ req, res }) {
        const origin = req.headers.get("origin")
        if (!origin) return
        const allowed = resolveOrigin(config, origin)
        if (!allowed) return
        res.headers.append("vary", "Origin")
        res.headers.set("access-control-allow-origin", allowed)
        if (config.credentials) res.headers.set("access-control-allow-credentials", "true")
        if (exposeHeaders) res.headers.set("access-control-expose-headers", exposeHeaders)
      },
    },
  }
}
