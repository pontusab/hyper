/**
 * Secure-by-default baseline.
 *
 * Applied by the app's fetch pipeline. Opt-out only — users can
 * override per-route via `.meta({ headers: {...} })` or disable
 * globally in `app({ security: {...} })`.
 */

import type { SecurityDefaults } from "./types.ts"

/** Default 1 MB body size limit. */
export const DEFAULT_BODY_LIMIT_BYTES: number = 1_048_576

/** Default response headers (sans HSTS; HSTS only added on HTTPS in prod). */
export const DEFAULT_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
})

/** Headers that must never be emitted by Hyper itself. */
export const SUPPRESSED_HEADERS: readonly string[] = Object.freeze(["server"])

/**
 * Keys that are refused by our JSON parser at the boundary to prevent
 * prototype pollution. Rejection raises a 400 HyperError.
 */
export const FORBIDDEN_JSON_KEYS: readonly string[] = Object.freeze([
  "__proto__",
  "constructor",
  "prototype",
])

export const DEFAULT_SECURITY: SecurityDefaults = {
  headers: true,
  bodyLimitBytes: DEFAULT_BODY_LIMIT_BYTES,
  rejectProtoKeys: true,
  serverHeader: false,
  rejectMethodOverride: true,
  requestTimeoutMs: 30_000,
  hstsEnv: "production",
}

/** Headers/body keys used to smuggle verbs via override. */
export const METHOD_OVERRIDE_HEADERS: readonly string[] = Object.freeze([
  "x-http-method-override",
  "x-method-override",
  "x-http-method",
])
export const METHOD_OVERRIDE_QUERY_KEYS: readonly string[] = Object.freeze(["_method"])

// Precomputed entries of the default response headers — hoisted out of
// the hot path so we don't pay an Object.entries allocation per request.
const DEFAULT_HEADER_ENTRIES: ReadonlyArray<readonly [string, string]> = Object.freeze(
  Object.entries(DEFAULT_RESPONSE_HEADERS),
)

/**
 * Apply default headers to a Response. Always returns a new Response
 * with a fresh Headers bag — the previous version tried to short-circuit
 * via `headersEqual`, which was strictly more expensive than cloning
 * (two Array allocations + two sorts every request).
 *
 * HSTS is added only when `https && emitHsts !== false`.
 */
export function applyDefaultHeaders(
  res: Response,
  opts: {
    https: boolean
    overrides?: Readonly<Record<string, string>>
    /** Emit HSTS. Typically set by the app only in production + HTTPS. */
    emitHsts?: boolean
  },
): Response {
  const { https, emitHsts, overrides } = opts
  const headers = new Headers(res.headers)
  for (let i = 0; i < DEFAULT_HEADER_ENTRIES.length; i++) {
    const entry = DEFAULT_HEADER_ENTRIES[i]!
    if (!headers.has(entry[0])) headers.set(entry[0], entry[1])
  }
  if (https && emitHsts !== false && !headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=15552000; includeSubDomains")
  }
  for (let i = 0; i < SUPPRESSED_HEADERS.length; i++) headers.delete(SUPPRESSED_HEADERS[i]!)
  if (overrides) {
    for (const k in overrides) {
      const v = overrides[k]
      if (v !== undefined) headers.set(k.toLowerCase(), v)
    }
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

/**
 * Deep-walk and reject forbidden keys (prototype pollution guard).
 * Throws `PrototypePollutionError` on hit.
 */
export function assertNoProtoKeys(value: unknown, path: string[] = []): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoProtoKeys(value[i], [...path, String(i)])
    }
    return
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_JSON_KEYS.includes(key)) {
      throw new PrototypePollutionError(key, path)
    }
    assertNoProtoKeys((value as Record<string, unknown>)[key], [...path, key])
  }
}

export class PrototypePollutionError extends Error {
  readonly key: string
  readonly path: readonly string[]
  constructor(key: string, path: readonly string[]) {
    super(`Refusing body containing dangerous key "${key}" at ${path.join(".") || "(root)"}`)
    this.name = "PrototypePollutionError"
    this.key = key
    this.path = path
  }
}
