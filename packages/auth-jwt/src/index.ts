/**
 * @hyper/auth-jwt — JWT authentication middleware + `.auth()` route sugar.
 *
 *   app({ plugins: [authJwtPlugin({ secret: env.JWT_SECRET })] })
 *   route.get("/me").auth().handle((c) => ok({ user: c.ctx.user }))
 *
 * `route.auth()` is a thin wrapper around `route.meta({ auth: true })`
 * plus a pre-chained middleware that enforces presence of `ctx.user`.
 */

import { RouteBuilder } from "@hyper/core"
import type { HyperPlugin, Middleware } from "@hyper/core"
import { JwtError, type JwtPayload, type VerifyOptions, verifyJwt } from "./jwt.ts"

export { JwtError, verifyJwt } from "./jwt.ts"
export type { JwtAlgorithm, JwtHeader, JwtPayload, VerifyOptions } from "./jwt.ts"

/**
 * Default `ctx.user` shape when no `loadUser` is supplied. Mirrors the
 * populated fields in the middleware below.
 */
export interface AuthUser {
  readonly sub: string
  readonly scope?: string | readonly string[]
}

export interface AuthJwtConfig extends VerifyOptions {
  /** Optional: map verified payload → ctx.user. */
  readonly loadUser?: (payload: JwtPayload) => unknown | Promise<unknown>
  /** Optional: where to look for the token. Default: Authorization: Bearer … */
  readonly extract?: (req: Request) => string | null
  /**
   * Opt out of the 32-byte secret length check. Off by default — a secret
   * shorter than 32 bytes is a bootable footgun and Hyper fails fast.
   */
  readonly allowShortSecret?: boolean
}

/** Minimum secret length we enforce at boot. 32 bytes = 256 bits. */
export const MIN_JWT_SECRET_BYTES = 32

/** Validates a JWT secret against the minimum-length rule. Throws with why/fix. */
export function validateJwtSecret(
  secret: string,
  opts: { readonly allowShort?: boolean } = {},
): void {
  if (opts.allowShort) return
  const bytes = new TextEncoder().encode(secret).byteLength
  if (bytes < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `@hyper/auth-jwt: secret is ${bytes} bytes; minimum is ${MIN_JWT_SECRET_BYTES}. Why: short HS256 secrets are brute-forceable in hours on commodity hardware. Fix: generate a 32+ byte secret (e.g., \`openssl rand -base64 48\`) or pass \`allowShortSecret: true\` at your own risk.`,
    )
  }
}

declare module "@hyper/core" {
  interface AppContext {
    /**
     * The authenticated user. Defaults to the `AuthUser` shape
     * populated by the middleware when no `loadUser` is supplied.
     *
     * To type a custom shape, augment this interface in your app:
     *   declare module "@hyper/core" {
     *     interface AppContext { user?: MyUser }
     *   }
     */
    readonly user?: AuthUser
    readonly jwt?: JwtPayload
  }
}

export function authJwt(config: AuthJwtConfig): Middleware {
  validateJwtSecret(config.secret, { allowShort: config.allowShortSecret ?? false })
  const extract = config.extract ?? defaultExtract
  return async ({ ctx, req, next }) => {
    const token = extract(req)
    if (!token) return unauthorized("missing_token")
    try {
      const { payload } = await verifyJwt(token, config)
      ;(ctx as { jwt?: JwtPayload }).jwt = payload
      if (config.loadUser) {
        ;(ctx as { user?: unknown }).user = await config.loadUser(payload)
      } else {
        ;(ctx as { user?: unknown }).user = { sub: payload.sub, scope: payload.scope }
      }
      return next()
    } catch (e) {
      if (e instanceof JwtError) return unauthorized(e.code)
      throw e
    }
  }
}

function defaultExtract(req: Request): string | null {
  const h = req.headers.get("authorization")
  if (!h) return null
  const [type, value] = h.split(" ")
  return type?.toLowerCase() === "bearer" ? (value ?? null) : null
}

function unauthorized(code: string) {
  return new Response(JSON.stringify({ error: "unauthorized", code }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="hyper", error="invalid_token"',
    },
  })
}

/**
 * Plugin — installs the `.auth()` method on the route builder prototype.
 * Consumers only need to chain `use(authJwt(...))` on protected routes,
 * or call `.auth()` as sugar.
 */
export function authJwtPlugin(config: AuthJwtConfig): HyperPlugin {
  validateJwtSecret(config.secret, { allowShort: config.allowShortSecret ?? false })
  installAuthMethod(authJwt(config))
  return {
    name: "@hyper/auth-jwt",
  }
}

/**
 * Install `.auth()` on the RouteBuilder prototype. Safe to call many times —
 * idempotent. Exported so tests and userland can pre-install without a plugin.
 */
export function installAuthMethod(mw: Middleware): void {
  const proto = (
    RouteBuilder as unknown as {
      prototype: {
        auth?: () => unknown
        use: (m: Middleware) => unknown
        meta: (m: Record<string, unknown>) => { use: (m: Middleware) => unknown }
      }
    }
  ).prototype
  if (proto.auth) return
  proto.auth = function auth(this: {
    meta: (m: Record<string, unknown>) => { use: (m: Middleware) => unknown }
  }) {
    return this.meta({ auth: true }).use(mw)
  }
}
