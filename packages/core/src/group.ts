/**
 * group(prefix) — full composition API.
 *
 * - `.use(middleware)` — prepended to each route's chain
 * - `.meta(obj)` — merged into each route's meta
 * - `.add(...routes)` — register routes (paths rewritten with prefix)
 * - `.merge(otherGroup)` — absorb another group's routes+middleware
 * - `.prefix(more)` — return a new group rooted deeper
 * - `.lazy(() => import(...))` — code-splitting; resolved on first match
 *
 * Plain-object router shape:
 *   app({ router: { users: { create, get } } })
 * is equivalent to a group tree — the nested-object layout maps 1:1
 * into `api.users.create()` at the client.
 */

import { type Middleware, compileChain } from "./middleware.ts"
import type { Route, RouteGroup, RouteMeta } from "./types.ts"

export type LazyGroup = () => Promise<{ default: GroupBuilder } | GroupBuilder>

export class GroupBuilder {
  readonly #prefix: string
  readonly #routes: Route[] = []
  readonly #middleware: Middleware[] = []
  readonly #meta: RouteMeta = {}
  readonly #lazyLoaders: LazyGroup[] = []

  constructor(prefix = "") {
    this.#prefix = normalizePrefix(prefix)
  }

  add(...routes: Route[]): GroupBuilder {
    for (const r of routes) {
      this.#routes.push(this.#decorate(r))
    }
    return this
  }

  use(mw: Middleware): GroupBuilder {
    this.#middleware.push(mw)
    // Re-decorate: existing routes need the new middleware prepended.
    for (let i = 0; i < this.#routes.length; i++) {
      const r = this.#routes[i]!
      this.#routes[i] = {
        ...r,
        handler: wrapWithMiddleware(r.path, r.handler, [mw]),
      }
    }
    return this
  }

  meta(meta: RouteMeta): GroupBuilder {
    Object.assign(this.#meta, meta)
    for (let i = 0; i < this.#routes.length; i++) {
      const r = this.#routes[i]!
      this.#routes[i] = { ...r, meta: { ...meta, ...r.meta } }
    }
    return this
  }

  prefix(more: string): GroupBuilder {
    return new GroupBuilder(joinPath(this.#prefix, more))
  }

  merge(other: GroupBuilder): GroupBuilder {
    const built = other.build()
    // Merged routes already carry their full path; don't re-prefix.
    for (const r of built.routes) {
      const handler =
        this.#middleware.length > 0
          ? wrapWithMiddleware(r.path, r.handler, this.#middleware)
          : r.handler
      this.#routes.push({ ...r, meta: { ...this.#meta, ...r.meta }, handler })
    }
    return this
  }

  lazy(loader: LazyGroup): GroupBuilder {
    this.#lazyLoaders.push(loader)
    return this
  }

  /** Resolve lazy groups (called by app() at construction). */
  async resolve(): Promise<void> {
    for (const loader of this.#lazyLoaders) {
      const mod = await loader()
      const g = mod instanceof GroupBuilder ? mod : mod.default
      await g.resolve()
      this.merge(g)
    }
  }

  build(): RouteGroup {
    return { prefix: this.#prefix, routes: [...this.#routes] }
  }

  /**
   * Invoke a route as a function (integration tests, projections).
   * Walks the group's routes and dispatches to .callable() when present.
   */
  async call<T = unknown>(
    method: string,
    path: string,
    input: {
      params?: Record<string, unknown>
      query?: Record<string, unknown>
      body?: unknown
      headers?: Record<string, string>
      req?: Request
    } = {},
  ): Promise<T> {
    const routes = [...this.#routes]
    const full = joinPath("", path)
    const match = routes.find((r) => r.method === method.toUpperCase() && r.path === full)
    if (!match) throw new Error(`group.call: no route ${method} ${full}`)
    // Prefer attached .callable() if present.
    const callable = (match as { callable?: (i: unknown) => Promise<unknown> }).callable
    if (callable) return callable(input) as Promise<T>
    // Fallback: run via internal handler.
    const req = input.req ?? new Request(`http://local${full}`, { method })
    const result = await match.handler({
      req,
      url: new URL(req.url),
      params: (input.params ?? {}) as Record<string, string>,
      query: new URLSearchParams((input.query as Record<string, string> | undefined) ?? {}),
      headers: new Headers((input.headers ?? {}) as Record<string, string>),
      body: input.body,
      ctx: {},
      cookies: () => new Bun.CookieMap(req.headers.get("cookie") ?? ""),
      responseHeaders: new Headers(),
    })
    return result as T
  }

  #decorate(r: Route): Route {
    const path = joinPath(this.#prefix, r.path)
    const meta = { ...this.#meta, ...r.meta }
    const handler =
      this.#middleware.length > 0
        ? wrapWithMiddleware(path, r.handler, this.#middleware)
        : r.handler
    return { ...r, path, meta, handler }
  }
}

function wrapWithMiddleware(
  path: string,
  handler: Route["handler"],
  mws: readonly Middleware[],
): Route["handler"] {
  const runner = compileChain(mws)
  return (ictx) =>
    runner(
      {
        ctx: ictx.ctx,
        input: { params: ictx.params, query: ictx.query, body: ictx.body, headers: ictx.headers },
        req: ictx.req,
        path,
        params: ictx.params,
      },
      () => handler(ictx),
    ) as ReturnType<Route["handler"]>
}

export function group(prefix = ""): GroupBuilder {
  return new GroupBuilder(prefix)
}

/** Create a lazy group placeholder. */
export function lazy(loader: LazyGroup): GroupBuilder {
  const g = new GroupBuilder()
  g.lazy(loader)
  return g
}

function normalizePrefix(p: string): string {
  if (p === "" || p === "/") return ""
  let out = p.startsWith("/") ? p : `/${p}`
  if (out.endsWith("/")) out = out.slice(0, -1)
  return out
}

function joinPath(prefix: string, rest: string): string {
  const r = rest.startsWith("/") ? rest : `/${rest}`
  if (prefix === "") return r
  return `${prefix}${r}`
}

// ------------------------------------------------------------------
// Plain-object router → GroupBuilder
// ------------------------------------------------------------------

/**
 * A plain-object router. Nested records of routes or
 * sub-routers become a group tree. Paths come from the route's own
 * `.path`; object keys provide the typed-client namespace only.
 */
export interface PlainRouter {
  [key: string]: Route | PlainRouter
}

export function fromPlainRouter(router: PlainRouter, prefix = ""): GroupBuilder {
  const g = new GroupBuilder(prefix)
  walk(router, g)
  return g
}

function walk(router: PlainRouter, g: GroupBuilder): void {
  for (const v of Object.values(router)) {
    if (isRoute(v)) g.add(v)
    else walk(v, g)
  }
}

function isRoute(x: unknown): x is Route {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { handler?: unknown }).handler === "function" &&
    typeof (x as { method?: unknown }).method === "string" &&
    typeof (x as { path?: unknown }).path === "string"
  )
}
