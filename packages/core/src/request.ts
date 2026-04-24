/**
 * Request parsing — lazy, size-capped, prototype-safe.
 *
 * Body parsing only runs when a route declares a `.body(schema)` or a
 * middleware reads `ctx.body`. We count bytes against the body limit
 * before calling `JSON.parse` so oversized payloads fail fast with 413.
 */

import { HyperError } from "./error.ts"
import {
  DEFAULT_BODY_LIMIT_BYTES,
  FORBIDDEN_JSON_KEYS,
  PrototypePollutionError,
  assertNoProtoKeys,
} from "./security.ts"

function jsonSafeReviver(key: string, value: unknown): unknown {
  if (FORBIDDEN_JSON_KEYS.includes(key)) {
    throw new HyperError({
      status: 400,
      code: "proto_pollution",
      message: `Refusing body containing dangerous key "${key}".`,
      why: "The body contains a prototype-pollution vector.",
      fix: "Remove the __proto__ / constructor / prototype key from the payload.",
      cause: new PrototypePollutionError(key, []),
    })
  }
  return value
}

export interface ReadBodyOptions {
  readonly maxBytes?: number
}

/**
 * Read a request body as text honoring the byte limit. We avoid
 * `req.text()` so we can bail fast before buffering more than allowed.
 */
export async function readTextBody(req: Request, opts: ReadBodyOptions = {}): Promise<string> {
  const max = opts.maxBytes ?? DEFAULT_BODY_LIMIT_BYTES
  if (!req.body) return ""
  const contentLength = req.headers.get("content-length")
  if (contentLength !== null) {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > max) {
      throw payloadTooLarge(declared, max)
    }
  }

  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let out = ""
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > max) throw payloadTooLarge(total, max)
        out += decoder.decode(value, { stream: true })
      }
    }
    out += decoder.decode()
  } finally {
    reader.releaseLock?.()
  }
  return out
}

/**
 * Parse request body as JSON with prototype-pollution guard and size cap.
 * Returns `undefined` for no-body requests.
 */
export async function parseJsonBody(req: Request, opts: ReadBodyOptions = {}): Promise<unknown> {
  const text = await readTextBody(req, opts)
  if (text === "") return undefined
  let parsed: unknown
  try {
    // Reviver catches __proto__ / constructor / prototype keys before
    // they can pollute the prototype chain. JSON.parse's own __proto__
    // behavior is to assign to [[Prototype]] directly — so a post-hoc
    // Object.keys check never sees it. We reject at read time instead.
    parsed = JSON.parse(text, jsonSafeReviver)
  } catch (e) {
    if (e instanceof HyperError) throw e
    throw new HyperError({
      status: 400,
      code: "invalid_json",
      message: "Request body is not valid JSON.",
      why: "The body failed JSON.parse.",
      fix: "Send a JSON payload matching the declared schema.",
      cause: e,
    })
  }
  assertNoProtoKeys(parsed)
  return parsed
}

/** Auto-detect the right body parser from content-type. */
export async function parseBodyAuto(req: Request, opts: ReadBodyOptions = {}): Promise<unknown> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase()
  if (!ct || ct.startsWith("application/json") || ct.startsWith("application/ld+json")) {
    return parseJsonBody(req, opts)
  }
  if (ct.startsWith("text/")) {
    return readTextBody(req, opts)
  }
  if (ct.startsWith("application/x-www-form-urlencoded")) {
    const text = await readTextBody(req, opts)
    const out: Record<string, string> = {}
    const params = new URLSearchParams(text)
    params.forEach((v, k) => {
      if (k === "__proto__" || k === "constructor" || k === "prototype") return
      out[k] = v
    })
    return out
  }
  if (ct.startsWith("multipart/form-data")) {
    // Buffer the form; Bun's Request.formData respects body stream.
    return req.formData()
  }
  // Binary passthrough (rare for handlers — they should opt in explicitly).
  return req.arrayBuffer()
}

function payloadTooLarge(got: number, max: number): HyperError {
  return new HyperError({
    status: 413,
    code: "payload_too_large",
    message: `Request body is ${got} bytes, limit is ${max}.`,
    why: "Bodies exceed Hyper's configured maxBytes.",
    fix: "Increase the limit on the route via `.body(schema, { maxBytes })` or trim the payload.",
  })
}
