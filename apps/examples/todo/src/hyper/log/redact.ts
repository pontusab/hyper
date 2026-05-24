/**
 * Redaction — path-based masking for log events.
 *
 * Performance note: we pre-compile the redact path list into a small set
 * and short-circuit when the set is empty.
 */

const MASK = "[REDACTED]"

/** Default keys that are always masked when encountered. */
export const DEFAULT_REDACT: readonly string[] = [
  "password",
  "pass",
  "token",
  "authorization",
  "cookie",
  "secret",
  "api_key",
  "apiKey",
  "access_token",
  "refresh_token",
  "ssn",
] as const

export function redact(value: unknown, paths: readonly string[] = DEFAULT_REDACT): unknown {
  if (value == null) return value
  const set = new Set(paths.map((p) => p.toLowerCase()))
  if (set.size === 0) return value
  return walk(value, set, "")
}

function walk(v: unknown, set: Set<string>, prefix: string): unknown {
  if (v == null || typeof v !== "object") return v
  if (Array.isArray(v)) return v.map((x, i) => walk(x, set, `${prefix}[${i}]`))
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (set.has(k.toLowerCase()) || set.has(path.toLowerCase())) {
      out[k] = MASK
    } else {
      out[k] = walk(val, set, path)
    }
  }
  return out
}
