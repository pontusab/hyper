/**
 * Auth test helpers.
 *
 * `signJwtHS256({...})` — produces a real signed HS256 JWT you can put
 * in the `authorization: Bearer <token>` header. Bun.CryptoHasher is the
 * same primitive `@hyper/auth-jwt` uses, so end-to-end tests exercise
 * the production verify path.
 */

import { createHmac } from "node:crypto"

export interface SignJwtOptions {
  readonly secret: string
  readonly payload: Record<string, unknown>
  readonly expiresInMs?: number
  readonly now?: () => number
}

export function signJwtHS256(opts: SignJwtOptions): string {
  const now = (opts.now ?? Date.now)()
  const header = { alg: "HS256", typ: "JWT" }
  const payload: Record<string, unknown> = {
    iat: Math.floor(now / 1000),
    ...(opts.expiresInMs ? { exp: Math.floor((now + opts.expiresInMs) / 1000) } : {}),
    ...opts.payload,
  }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(payload))
  const sig = createHmac("sha256", opts.secret).update(`${h}.${p}`).digest()
  return `${h}.${p}.${b64urlBuf(sig)}`
}

/** Convenience — `asUser({ id })` + a real bearer header in one call. */
export function bearerAsUser(opts: {
  readonly secret: string
  readonly id: string
  readonly roles?: readonly string[]
  readonly expiresInMs?: number
}): { authorization: string } {
  const token = signJwtHS256({
    secret: opts.secret,
    payload: { sub: opts.id, ...(opts.roles && { roles: opts.roles }) },
    ...(opts.expiresInMs !== undefined && { expiresInMs: opts.expiresInMs }),
  })
  return { authorization: `Bearer ${token}` }
}

function b64url(s: string): string {
  return b64urlBuf(Buffer.from(s, "utf8"))
}
function b64urlBuf(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
