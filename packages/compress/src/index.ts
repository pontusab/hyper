/**
 * @hyper/compress — content-negotiated gzip/brotli compression.
 *
 * Wired as middleware (not a plugin) because we need to return a new
 * Response. Inspect the handler's response, negotiate the encoding,
 * compress in a single sync pass with Bun.gzipSync / node:zlib brotli.
 *
 * Defaults follow the "safe-by-default" philosophy:
 *   - Only compress text/*, application/json, javascript, xml, svg, wasm.
 *     No images/video/audio.
 *   - Skip responses smaller than 1 KB (overhead dominates).
 *   - Always set `Vary: Accept-Encoding` when we might compress.
 */

import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib"
import { type Middleware, coerce } from "@hyper/core"

export interface CompressConfig {
  readonly threshold?: number
  readonly brotli?: boolean
  readonly types?: readonly string[]
  readonly level?: { readonly gzip?: number; readonly brotli?: number }
}

const DEFAULT_TYPES: readonly string[] = Object.freeze([
  "text/",
  "application/json",
  "application/ld+json",
  "application/javascript",
  "application/xml",
  "image/svg+xml",
  "application/wasm",
  "application/manifest+json",
])

export function compress(config: CompressConfig = {}): Middleware {
  const threshold = config.threshold ?? 1024
  const preferBrotli = config.brotli ?? true
  const types = [...DEFAULT_TYPES, ...(config.types ?? [])]
  const gzipLevel = config.level?.gzip ?? 6
  const brotliLevel = config.level?.brotli ?? 5

  return async ({ req, next }) => {
    const out = await next()
    const res = out instanceof Response ? out : coerce(out)
    if (res.headers.has("content-encoding")) return res

    const ae = req.headers.get("accept-encoding")?.toLowerCase() ?? ""
    const acceptsBr = preferBrotli && ae.includes("br")
    const acceptsGz = ae.includes("gzip")
    if (!acceptsBr && !acceptsGz) return res

    const ct = res.headers.get("content-type")?.toLowerCase() ?? ""
    if (!ct || !types.some((t) => ct.startsWith(t))) return res

    const body = new Uint8Array(await res.arrayBuffer())
    // Always signal negotiation even if we don't compress.
    if (body.byteLength < threshold) {
      const hh = new Headers(res.headers)
      hh.append("vary", "Accept-Encoding")
      return new Response(body, { status: res.status, statusText: res.statusText, headers: hh })
    }

    let encoded: Uint8Array
    let enc: string
    if (acceptsBr) {
      encoded = brotliCompressSync(body, {
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: brotliLevel },
      })
      enc = "br"
    } else {
      encoded = gzipSync(body, { level: gzipLevel })
      enc = "gzip"
    }

    const headers = new Headers(res.headers)
    headers.set("content-encoding", enc)
    headers.set("content-length", encoded.byteLength.toString())
    headers.append("vary", "Accept-Encoding")
    return new Response(encoded, { status: res.status, statusText: res.statusText, headers })
  }
}
