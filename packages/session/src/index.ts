/**
 * @hyper/session — encrypted, signed-cookie session middleware.
 *
 * - Cookie stores a short opaque id; payload lives in the pluggable
 *   `SessionStore` (in-memory by default).
 * - Session id is HMAC-signed; mismatch = session discarded, no 500.
 * - Rolling expiration by default; consumer can opt into absolute.
 * - `ctx.session.set/get/destroy/regenerate` for handler use.
 */

import { timingSafeEqual } from "node:crypto"
import { type Middleware, coerce } from "@hyper/core"

export { csrfGuard, type CsrfConfig } from "./csrf.ts"

export interface SessionStore {
  get(id: string): Promise<Record<string, unknown> | undefined>
  set(id: string, data: Record<string, unknown>, ttlMs: number): Promise<void>
  destroy(id: string): Promise<void>
}

export function memorySessions(): SessionStore {
  const m = new Map<string, { data: Record<string, unknown>; expires: number }>()
  return {
    async get(id) {
      const v = m.get(id)
      if (!v) return undefined
      if (v.expires < Date.now()) {
        m.delete(id)
        return undefined
      }
      return v.data
    },
    async set(id, data, ttlMs) {
      m.set(id, { data, expires: Date.now() + ttlMs })
    },
    async destroy(id) {
      m.delete(id)
    },
  }
}

export interface SessionConfig {
  readonly secret: string
  readonly store?: SessionStore
  readonly cookieName?: string
  /** ms. Default: 7 days. */
  readonly ttlMs?: number
  /** Renew cookie on every request. Default: true. */
  readonly rolling?: boolean
  /** Secure cookie flag. Default: true. */
  readonly secure?: boolean
  readonly sameSite?: "Strict" | "Lax" | "None"
  /** Opt out of the 32-byte secret check. Off by default. */
  readonly allowShortSecret?: boolean
}

export const MIN_SESSION_SECRET_BYTES = 32

export function validateSessionSecret(
  secret: string,
  opts: { readonly allowShort?: boolean } = {},
): void {
  if (opts.allowShort) return
  const bytes = new TextEncoder().encode(secret).byteLength
  if (bytes < MIN_SESSION_SECRET_BYTES) {
    throw new Error(
      `@hyper/session: secret is ${bytes} bytes; minimum is ${MIN_SESSION_SECRET_BYTES}. Why: short HMAC secrets let an attacker forge session ids with modest compute. Fix: generate a 32+ byte secret (e.g., \`openssl rand -base64 48\`) or pass \`allowShortSecret: true\` to opt out.`,
    )
  }
}

export interface SessionHandle {
  readonly id: string
  get<T = unknown>(key: string): T | undefined
  set(key: string, value: unknown): void
  destroy(): void
  regenerate(): void
  readonly dirty: boolean
}

declare module "@hyper/core" {
  interface AppContext {
    readonly session?: SessionHandle
  }
}

const WEEK = 7 * 24 * 60 * 60 * 1000

export function session(config: SessionConfig): Middleware {
  validateSessionSecret(config.secret, { allowShort: config.allowShortSecret ?? false })
  const store = config.store ?? memorySessions()
  const name = config.cookieName ?? "hyper.sid"
  const ttl = config.ttlMs ?? WEEK
  const rolling = config.rolling ?? true
  const secure = config.secure ?? true
  const sameSite = config.sameSite ?? "Lax"

  const mw: Middleware = async ({ ctx, req, next }) => {
    const existingId = await readSignedCookie(req, name, config.secret)
    let id = existingId ?? ""
    let data: Record<string, unknown> = {}
    if (id) {
      data = (await store.get(id)) ?? {}
    }
    let dirty = false
    let destroyed = false
    let regenerated = false

    const handle: SessionHandle = Object.freeze({
      get id() {
        return id
      },
      get<T>(k: string): T | undefined {
        return data[k] as T | undefined
      },
      set(k, v) {
        data[k] = v
        dirty = true
      },
      destroy() {
        destroyed = true
        dirty = true
      },
      regenerate() {
        regenerated = true
        dirty = true
      },
      get dirty() {
        return dirty
      },
    })
    ;(ctx as { session?: SessionHandle }).session = handle

    const out = await next()
    const res = out instanceof Response ? out : coerce(out)
    if (destroyed && id) {
      await store.destroy(id)
      res.headers.append(
        "set-cookie",
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}`,
      )
      return res
    }
    if (regenerated || (!id && Object.keys(data).length > 0)) {
      if (id) await store.destroy(id)
      id = newId()
    }
    if (dirty || (rolling && id)) {
      if (!id) id = newId()
      await store.set(id, data, ttl)
      const signed = await signCookie(id, config.secret)
      res.headers.append(
        "set-cookie",
        `${name}=${signed}; Path=/; Max-Age=${Math.floor(ttl / 1000)}; HttpOnly; SameSite=${sameSite}${
          secure ? "; Secure" : ""
        }`,
      )
    }
    return res
  }
  ;(mw as unknown as { __hyperTag: string }).__hyperTag = "@hyper/session"
  return mw
}

async function readSignedCookie(
  req: Request,
  name: string,
  secret: string,
): Promise<string | null> {
  const header = req.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(/;\s*/)) {
    const [k, ...rest] = part.split("=")
    if (k === name && rest.length) {
      const value = rest.join("=")
      const id = await verifyCookie(value, secret)
      if (id) return id
    }
  }
  return null
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

async function signCookie(id: string, secret: string): Promise<string> {
  const key = await importHmac(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id))
  const b64 = b64url(new Uint8Array(sig))
  return `${id}.${b64}`
}

async function verifyCookie(value: string, secret: string): Promise<string | null> {
  const dot = value.lastIndexOf(".")
  if (dot <= 0) return null
  const id = value.slice(0, dot)
  const sigB64 = value.slice(dot + 1)
  const key = await importHmac(secret)
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id)),
  )
  const actual = fromB64url(sigB64)
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return null
  return id
}

async function importHmac(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

function b64url(b: Uint8Array): string {
  let s = ""
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4)
  const b64 = (s + "====".slice(0, pad)).replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
