/**
 * CSRF double-submit protection for cookie-authenticated routes.
 *
 * Strategy: on every response where a session is active, we issue a
 * non-HttpOnly `csrf` cookie containing a random token. For mutating
 * methods (POST/PUT/PATCH/DELETE), we verify that the client echoed
 * the token back in the `X-CSRF-Token` header (constant-time compare).
 *
 * Usage:
 *
 *   const sess = session({ secret: env.SESSION_SECRET })
 *   const guard = csrfGuard()
 *   route.post("/mutate").use(sess).use(guard).handle(...)
 *
 * Or pre-bind the pair:
 *
 *   const { session: sess, csrf: guard } = sessionWithCsrf({ secret })
 *
 * Pure-bearer endpoints that deliberately ignore cookies can omit
 * `csrfGuard()` — it only acts when `ctx.session` is present.
 */

import { timingSafeEqual } from "node:crypto"
import { type Middleware, coerce, createError } from "@hyper/core"

export interface CsrfConfig {
  readonly cookieName?: string
  readonly headerName?: string
  readonly sameSite?: "Strict" | "Lax" | "None"
  readonly secure?: boolean
  /** Methods that never require a CSRF check. Default: safe verbs. */
  readonly exemptMethods?: readonly string[]
}

const DEFAULT_EXEMPT = ["GET", "HEAD", "OPTIONS"] as const

export function csrfGuard(config: CsrfConfig = {}): Middleware {
  const cookieName = config.cookieName ?? "csrf"
  const headerName = (config.headerName ?? "x-csrf-token").toLowerCase()
  const sameSite = config.sameSite ?? "Lax"
  const secure = config.secure ?? true
  const exempt = new Set((config.exemptMethods ?? DEFAULT_EXEMPT).map((m) => m.toUpperCase()))

  const mw: Middleware = async ({ ctx, req, next }) => {
    const sess = (ctx as { session?: { id?: string } }).session
    // Only protect requests whose session was *loaded from* an incoming
    // cookie. Freshly-minted sessions (first-time login) don't have a
    // csrf cookie to echo yet — that would create a chicken-and-egg block.
    const isEstablished = !!sess?.id
    const method = req.method.toUpperCase()
    const cookieToken = readCookie(req, cookieName)
    const hasSession = !!sess

    if (isEstablished && !exempt.has(method)) {
      const headerToken = req.headers.get(headerName)
      if (!cookieToken || !headerToken || !constantTimeEq(cookieToken, headerToken)) {
        throw createError({
          status: 403,
          code: "csrf_token_mismatch",
          message: "Missing or invalid CSRF token.",
          why: "Mutating request from a cookie-authenticated session without a matching CSRF token.",
          fix: `Include the '${headerName}' header with the value from the '${cookieName}' cookie. Non-browser clients should use bearer auth instead of cookies.`,
        })
      }
    }

    const out = await next()
    const res = out instanceof Response ? out : coerce(out)

    if (hasSession && !cookieToken) {
      const tok = newToken()
      res.headers.append(
        "set-cookie",
        `${cookieName}=${tok}; Path=/; SameSite=${sameSite}${secure ? "; Secure" : ""}`,
      )
    }
    return res
  }
  ;(mw as unknown as { __hyperTag: string }).__hyperTag = "@hyper/session:csrf"
  return mw
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(/;\s*/)) {
    const [k, ...rest] = part.split("=")
    if (k === name) return rest.join("=")
  }
  return null
}

function constantTimeEq(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(Buffer.from(ab), Buffer.from(bb))
}

function newToken(): string {
  const buf = new Uint8Array(24)
  crypto.getRandomValues(buf)
  let s = ""
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
