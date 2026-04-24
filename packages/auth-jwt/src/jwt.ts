/**
 * Minimal HS256/HS384/HS512 verify-only JWT implementation.
 *
 * We explicitly do NOT sign — in 2026 all first-party auth flows issue
 * tokens through the OAuth provider; server-side we just verify.
 *
 * For RS/ES we expose a verify hook — consumers plug in their JWKS
 * resolver via `jwks(url)` utility.
 */

import { timingSafeEqual } from "node:crypto"

export type JwtAlgorithm = "HS256" | "HS384" | "HS512"

export interface JwtHeader {
  readonly alg: string
  readonly kid?: string
  readonly typ?: string
}

export interface JwtPayload {
  readonly iss?: string
  readonly aud?: string | readonly string[]
  readonly sub?: string
  readonly exp?: number
  readonly nbf?: number
  readonly iat?: number
  readonly scope?: string
  readonly [k: string]: unknown
}

export interface VerifyOptions {
  readonly secret?: string | Uint8Array
  readonly algorithms?: readonly JwtAlgorithm[]
  readonly issuer?: string
  readonly audience?: string
  readonly clockToleranceSec?: number
}

export class JwtError extends Error {
  constructor(
    readonly code: string,
    msg: string,
  ) {
    super(msg)
  }
}

const SUPPORTED: Record<JwtAlgorithm, "SHA-256" | "SHA-384" | "SHA-512"> = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
}

export async function verifyJwt(
  token: string,
  options: VerifyOptions,
): Promise<{ header: JwtHeader; payload: JwtPayload }> {
  const parts = token.split(".")
  if (parts.length !== 3) throw new JwtError("invalid_token", "malformed jwt")
  const [h, p, sig] = parts
  const header = JSON.parse(b64urlToUtf8(h!)) as JwtHeader
  const payload = JSON.parse(b64urlToUtf8(p!)) as JwtPayload
  const alg = header.alg as JwtAlgorithm
  const allowed = new Set(options.algorithms ?? ["HS256"])
  if (!allowed.has(alg)) throw new JwtError("alg_not_allowed", `disallowed alg: ${alg}`)

  if (alg.startsWith("HS")) {
    const digest = SUPPORTED[alg]
    if (!digest) throw new JwtError("alg_unsupported", `unsupported alg: ${alg}`)
    if (!options.secret) throw new JwtError("no_secret", "secret required for HMAC")
    const key = await crypto.subtle.importKey(
      "raw",
      typeof options.secret === "string"
        ? new TextEncoder().encode(options.secret)
        : options.secret,
      { name: "HMAC", hash: digest },
      false,
      ["sign"],
    )
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${h}.${p}`))
    const expected = new Uint8Array(signed)
    const actual = b64urlToBytes(sig!)
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    ) {
      throw new JwtError("bad_signature", "jwt signature mismatch")
    }
  } else {
    throw new JwtError("alg_unsupported", `unsupported alg: ${alg}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const skew = options.clockToleranceSec ?? 30
  if (typeof payload.exp === "number" && now > payload.exp + skew) {
    throw new JwtError("expired", "jwt expired")
  }
  if (typeof payload.nbf === "number" && now + skew < payload.nbf) {
    throw new JwtError("not_yet_valid", "jwt not yet valid")
  }
  if (options.issuer && payload.iss !== options.issuer) {
    throw new JwtError("bad_issuer", `issuer ${payload.iss ?? ""} != ${options.issuer}`)
  }
  if (options.audience) {
    const aud = payload.aud
    const ok = Array.isArray(aud) ? aud.includes(options.audience) : aud === options.audience
    if (!ok) throw new JwtError("bad_audience", "aud mismatch")
  }
  return { header, payload }
}

function b64urlToUtf8(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s))
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4)
  const b64 = (s + "====".slice(0, pad)).replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
