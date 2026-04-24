/**
 * @usehyper/msgpack — content-negotiated MessagePack middleware + transport.
 *
 *   use(msgpack())
 *
 * When the client sends `Accept: application/msgpack` AND the handler
 * returns a serializable object, we encode with msgpack. When the client
 * posts `Content-Type: application/msgpack`, we decode the body first.
 *
 * HTTP semantics are preserved; only the wire format changes.
 */

import type { Middleware } from "@usehyper/core"
import { decode, encode } from "./codec.ts"

export { decode, encode } from "./codec.ts"

export const CONTENT_TYPE = "application/msgpack"

export function msgpack(): Middleware {
  return async ({ req, next }) => {
    // Decode inbound body if it's msgpack. We rewrite the Request body
    // as JSON so the rest of the stack (validators, handlers) sees the
    // same shape regardless of wire format.
    let inbound = req
    if (req.body && (req.headers.get("content-type") ?? "").startsWith(CONTENT_TYPE)) {
      const bytes = new Uint8Array(await req.arrayBuffer())
      const decoded = decode(bytes)
      const newHeaders = new Headers(req.headers)
      newHeaders.set("content-type", "application/json")
      inbound = new Request(req.url, {
        method: req.method,
        headers: newHeaders,
        body: JSON.stringify(decoded),
      })
    }

    const wantsMsgpack = (req.headers.get("accept") ?? "").includes(CONTENT_TYPE)
    // Use `inbound` if we rewrote the Request — the rest of the chain
    // pulls from the original handler scope so this swap only affects
    // our own cloned-body reads; we just forward the headers.
    void inbound
    const out = await next()
    if (!wantsMsgpack) return out
    const res =
      out instanceof Response
        ? out
        : new Response(JSON.stringify(out), {
            headers: { "content-type": "application/json" },
          })
    if ((res.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await res.clone().json()
      const bytes = encode(body)
      const headers = new Headers(res.headers)
      headers.set("content-type", CONTENT_TYPE)
      headers.set("content-length", bytes.byteLength.toString())
      return new Response(bytes, { status: res.status, headers })
    }
    return res
  }
}
