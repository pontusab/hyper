/**
 * Return helpers + response coercion.
 *
 * The philosophy: handlers return values. The framework converts those
 * into `Response` objects with correct status codes. Helpers make the
 * status explicit at the return site and keep TypeScript inference clean.
 *
 * Perf note: helpers pre-merge the secure-by-default response headers so
 * `finalize()` in app.ts can skip the Headers-clone + new-Response cost
 * on the common path (only paying for HSTS / route overrides when those
 * features are actually in play).
 */

import type { HyperError } from "./error.ts"
import type { BunFileLike, HandlerReturn } from "./types.ts"

/**
 * Bake Hyper's secure-by-default headers directly into the Response
 * constructed by the helpers. The pipeline detects these via a single
 * `headers.has("x-content-type-options")` probe and skips the Headers
 * clone when no other mutation is needed.
 */
const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
})

const JSON_HEADERS_PREBAKED: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  ...DEFAULT_SECURITY_HEADERS,
})

const TEXT_HEADERS_PREBAKED: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "text/plain; charset=utf-8",
  ...DEFAULT_SECURITY_HEADERS,
})

const HTML_HEADERS_PREBAKED: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "text/html; charset=utf-8",
  ...DEFAULT_SECURITY_HEADERS,
})

/** Branded helper result — carries status so TS can infer response types. */
export interface TypedResponse<S extends number, B> extends Response {
  readonly __hyper?: { status: S; body: B }
}

// --- 2xx ------------------------------------------------------------------

export function ok<B>(body: B, init?: ResponseInit): TypedResponse<200, B> {
  return jsonResponse(200, body, init) as TypedResponse<200, B>
}

export function created<B>(body: B, init?: ResponseInit): TypedResponse<201, B> {
  return jsonResponse(201, body, init) as TypedResponse<201, B>
}

export function accepted<B>(body: B, init?: ResponseInit): TypedResponse<202, B> {
  return jsonResponse(202, body, init) as TypedResponse<202, B>
}

export function noContent(init?: ResponseInit): TypedResponse<204, null> {
  if (!init) {
    return new Response(null, {
      status: 204,
      headers: DEFAULT_SECURITY_HEADERS,
    }) as TypedResponse<204, null>
  }
  const headers = mergeHeaders(init.headers, DEFAULT_SECURITY_HEADERS)
  return new Response(null, { ...init, status: 204, headers }) as TypedResponse<204, null>
}

// --- 3xx ------------------------------------------------------------------

export function redirect(
  location: string,
  status: 301 | 302 | 303 | 307 | 308 = 302,
): TypedResponse<301 | 302 | 303 | 307 | 308, null> {
  return new Response(null, {
    status,
    headers: { location },
  }) as TypedResponse<301 | 302 | 303 | 307 | 308, null>
}

// --- 4xx error helpers (returned, not thrown) ----------------------------

export function badRequest<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<400, B> {
  return jsonResponse(400, body ?? null, init) as unknown as TypedResponse<400, B>
}

export function unauthorized<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<401, B> {
  return jsonResponse(401, body ?? null, init) as unknown as TypedResponse<401, B>
}

export function forbidden<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<403, B> {
  return jsonResponse(403, body ?? null, init) as unknown as TypedResponse<403, B>
}

export function notFound<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<404, B> {
  return jsonResponse(404, body ?? null, init) as unknown as TypedResponse<404, B>
}

export function conflict<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<409, B> {
  return jsonResponse(409, body ?? null, init) as unknown as TypedResponse<409, B>
}

export function unprocessable<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<422, B> {
  return jsonResponse(422, body ?? null, init) as unknown as TypedResponse<422, B>
}

export function tooManyRequests<B extends { code?: string } | undefined = undefined>(
  body?: B,
  init?: ResponseInit,
): TypedResponse<429, B> {
  return jsonResponse(429, body ?? null, init) as unknown as TypedResponse<429, B>
}

// --- Body helpers ---------------------------------------------------------

export function text(body: string, init?: ResponseInit): Response {
  if (!init) {
    return new Response(body, { status: 200, headers: TEXT_HEADERS_PREBAKED })
  }
  const headers = mergeHeaders(init.headers, TEXT_HEADERS_PREBAKED)
  return new Response(body, { ...init, status: init.status ?? 200, headers })
}

export function html(body: string, init?: ResponseInit): Response {
  if (!init) {
    return new Response(body, { status: 200, headers: HTML_HEADERS_PREBAKED })
  }
  const headers = mergeHeaders(init.headers, HTML_HEADERS_PREBAKED)
  return new Response(body, { ...init, status: init.status ?? 200, headers })
}

/** Server-Sent Events response. Pass an AsyncIterable of {data, event?, id?}. */
export function sse(
  source: AsyncIterable<{ data: string; event?: string; id?: string }>,
  init?: ResponseInit,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const ev of source) {
          let chunk = ""
          if (ev.id) chunk += `id: ${ev.id}\n`
          if (ev.event) chunk += `event: ${ev.event}\n`
          for (const line of ev.data.split("\n")) chunk += `data: ${line}\n`
          chunk += "\n"
          controller.enqueue(enc.encode(chunk))
        }
      } catch (err) {
        controller.error(err)
        return
      }
      controller.close()
    },
  })
  const headers = mergeHeaders(init?.headers, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  })
  return new Response(stream, { ...init, status: init?.status ?? 200, headers })
}

/** Generic streaming response (AsyncIterable of strings or bytes). */
export function stream(source: AsyncIterable<string | Uint8Array>, init?: ResponseInit): Response {
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const chunk of source) {
          controller.enqueue(typeof chunk === "string" ? enc.encode(chunk) : chunk)
        }
      } catch (err) {
        controller.error(err)
        return
      }
      controller.close()
    },
  })
  return new Response(readable, { ...init, status: init?.status ?? 200 })
}

// --- Internal -------------------------------------------------------------

export function jsonResponse(status: number, body: unknown, init?: ResponseInit): Response {
  const payload = body === null || body === undefined ? null : JSON.stringify(body)
  if (!init) {
    return new Response(payload, { status, headers: JSON_HEADERS_PREBAKED })
  }
  const headers = mergeHeaders(init.headers, JSON_HEADERS_PREBAKED)
  return new Response(payload, { ...init, status, headers })
}

function mergeHeaders(input: HeadersInit | undefined, defaults?: Record<string, string>): Headers {
  const h = new Headers(input)
  if (defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (!h.has(k)) h.set(k, v)
    }
  }
  return h
}

/**
 * Coerce a handler return into a Response. Rules:
 * - `Response` → passthrough
 * - `Bun.file`-like (has `.stream`) → streamed passthrough with content-type
 * - `ReadableStream` → 200 with stream body
 * - `string` → 200 text/plain
 * - everything else → 200 JSON
 */
export function coerce(value: HandlerReturn): Response {
  if (value instanceof Response) return value
  if (value === undefined || value === null) return new Response(null, { status: 204 })
  if (isBunFile(value)) return bunFileToResponse(value)
  if (value instanceof ReadableStream) return new Response(value, { status: 200 })
  if (typeof value === "string") return text(value)
  if (typeof value === "object" && value !== null && Symbol.asyncIterator in (value as object)) {
    return stream(value as AsyncIterable<string | Uint8Array>)
  }
  return ok(value)
}

function isBunFile(v: unknown): v is BunFileLike {
  return (
    typeof v === "object" && v !== null && typeof (v as { stream?: unknown }).stream === "function"
  )
}

function bunFileToResponse(file: BunFileLike): Response {
  const headers = new Headers()
  if (file.type) headers.set("content-type", file.type)
  if (typeof file.size === "number") headers.set("content-length", String(file.size))
  return new Response(file.stream(), { status: 200, headers })
}

// Error response projection ------------------------------------------------

export function errorResponse(err: HyperError): Response {
  return jsonResponse(err.status, err.toJSON())
}
