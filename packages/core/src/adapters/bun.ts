/**
 * Bun adapter helpers.
 *
 * Thin wrappers around `Bun.serve` that use the native `routes` map
 * emitted by the app + fall through to `fetch` for anything the map
 * cannot express (e.g. catch-alls, middleware-only paths).
 */

import type { HyperApp } from "../types.ts"

export interface ServeOptions {
  readonly port?: number
  readonly hostname?: string
  readonly idleTimeout?: number
  readonly tls?: import("bun").TLSOptions
  readonly development?: boolean
}

/** Convenience wrapper. Callers may always prefer `Bun.serve` directly. */
export function serve(app: HyperApp, opts: ServeOptions = {}): ReturnType<typeof Bun.serve> {
  const serveOpts: Record<string, unknown> = {
    routes: app.routes,
    fetch: app.fetch,
    idleTimeout: opts.idleTimeout ?? 10,
  }
  if (opts.port !== undefined) serveOpts.port = opts.port
  if (opts.hostname !== undefined) serveOpts.hostname = opts.hostname
  if (opts.tls !== undefined) serveOpts.tls = opts.tls
  if (opts.development !== undefined) serveOpts.development = opts.development
  // Cast: Bun.serve's Options union is too narrow for our generic shape;
  // the runtime accepts every key we set.
  return Bun.serve(serveOpts as unknown as Parameters<typeof Bun.serve>[0])
}
