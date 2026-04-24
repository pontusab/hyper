/**
 * Hyper — the top-level chain API.
 *
 * A thin, ergonomic wrapper around `app({...})` + the `route.<verb>`
 * builder. Construct a server with `new Hyper()`, add routes via verb
 * shortcuts, compose sub-apps / plugins / middleware / namespaces via
 * the polymorphic `.use()`, and boot with `.listen()`.
 *
 *   export default new Hyper()
 *     .get("/", () => "Hello Hyper")
 *     .listen(3000)
 *
 * The chain class is additive — everything still lowers to the existing
 * `Route`/`HyperApp` primitives, so plugins, openapi projection,
 * testing, and CLI tooling keep working unchanged.
 */

import type { Server } from "bun"
import { app } from "./app.ts"
import { GroupBuilder, fromPlainRouter } from "./group.ts"
import { type ChainRunner, type Middleware, compileChain } from "./middleware.ts"
import { type RouteBuilder, route } from "./route.ts"
import type { HandlerCtx } from "./route.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"
import type {
  AppConfig,
  AppContext,
  BunRoutes,
  DecorateFactory,
  DeriveFactory,
  EnvConfigLike,
  HandlerReturn,
  HttpMethod,
  HyperApp,
  HyperPlugin,
  InternalHandlerCtx,
  InvokeInput,
  InvokeResult,
  PlainRouterConfig,
  Route,
  RouteGroup,
  RouteHandler,
  RouteMeta,
  SecurityDefaults,
  TestOverrides,
} from "./types.ts"

/** Version string for the banner line. Stays in sync with `@hyper/core`. */
const HYPER_VERSION = "0.1.0"

/** Constructor-time options. */
export interface HyperOptions {
  /** Mount all routes added on this instance under this prefix. */
  readonly prefix?: string
  /** Security baseline overrides — merged with secure-by-default. */
  readonly security?: Partial<SecurityDefaults>
  /** Env schema + secrets + source. Parsed at boot. */
  readonly env?: EnvConfigLike
  /** Optional name — surfaces in banner, logs, and error messages. */
  readonly name?: string
}

/** Options for `.listen()`. */
export interface ListenOptions {
  readonly port?: number
  readonly hostname?: string
  /** Bun.serve idleTimeout (seconds). Default: 10. */
  readonly idleTimeout?: number
  /** Bun.serve development flag. Default: true when NODE_ENV !== "production". */
  readonly development?: boolean
  /** Print the startup banner. Default: true outside of production. */
  readonly banner?: boolean
  /** Wire SIGTERM/SIGINT → drain. Default: true. */
  readonly drain?: boolean
}

// ---------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------

/**
 * Extract the `:param` segments from a path literal as a `{ [name]: string }`
 * record. Falls back to an empty record when the path has no params — so
 * destructuring `({ params })` stays valid on schema-less static paths.
 */
export type PathParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>

/**
 * Narrow the output of a `StandardSchemaV1` or fall back to `Fallback`
 * when the schema is absent (undefined in the options bag).
 */
export type InferSchema<S, Fallback> = S extends StandardSchemaV1<unknown, infer O> ? O : Fallback

/** Per-route options accepted by the verb shortcuts. */
export interface RouteOpts<
  P extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
  Q extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
  B extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
  H extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
> {
  readonly params?: P
  readonly query?: Q
  readonly body?: B
  readonly headers?: H
  readonly meta?: RouteMeta
  readonly use?: readonly Middleware[]
  /** Declared thrown-error shapes keyed by HTTP status. */
  readonly throws?: Record<number, StandardSchemaV1>
  /** Named error-code catalog. */
  readonly errors?: Record<string, StandardSchemaV1>
}

/** The typed handler signature for `new Hyper<Ctx>().<verb>(path, [opts,] handler)`. */
export type VerbHandler<
  Path extends string = string,
  Opts extends RouteOpts | undefined = undefined,
  Ctx extends AppContext = AppContext,
> = (
  ctx: HandlerCtx<
    Opts extends { params: infer P } ? InferSchema<P, PathParams<Path>> : PathParams<Path>,
    Opts extends { query: infer Q } ? InferSchema<Q, unknown> : unknown,
    Opts extends { body: infer B } ? InferSchema<B, unknown> : unknown,
    Opts extends { headers: infer H } ? InferSchema<H, unknown> : unknown,
    Ctx
  >,
) => HandlerReturn | Promise<HandlerReturn>

/**
 * Polymorphic dispatch — `.use()` accepts any of these shapes.
 *
 * Order of discrimination (see {@link Hyper.use}):
 *   1. `Hyper`  — sub-app composition (its own prefix honored).
 *   2. `GroupBuilder` — flatten to RouteGroup, apply parent prefix.
 *   3. `RouteGroup`   — same as above.
 *   4. `Route` | `Route[]` — register directly.
 *   5. `HyperPlugin`  — install (must have `name: string`).
 *   6. `Middleware`   — `typeof fn === "function"`, appended to the stack.
 *   7. Plain object   — walked as an ESM namespace / PlainRouter.
 */
export type UseArg =
  // biome-ignore lint/suspicious/noExplicitAny: variance hole for heterogeneous Hyper<Ctx>
  | Hyper<any>
  | GroupBuilder
  | RouteGroup
  | Route
  | readonly Route[]
  | HyperPlugin
  | Middleware
  | Record<string, unknown>

/** Brand used for duck-typed recognition across package boundaries. */
export const HYPER_BUILDER_BRAND = "__hyperBuilder__" as const

// Shared state for graceful-shutdown handler. One process-level
// listener per signal no matter how many `Hyper` instances `.listen()`.
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous by design
const activeServers: Set<Hyper<any>> = new Set()
let drainInstalled = false

function installDrainHandlersOnce(): void {
  if (drainInstalled) return
  drainInstalled = true
  const shutdown = (signal: string): void => {
    // Drain every live server; do not exit until all have resolved.
    const pending: Promise<void>[] = []
    for (const inst of activeServers) {
      const s = inst.server
      if (!s) continue
      pending.push(
        Promise.resolve(s.stop(false))
          .then(() => undefined)
          .catch(() => undefined),
      )
    }
    void Promise.all(pending).then(() => {
      // Respect the Unix convention: 128 + signal number.
      const code = signal === "SIGTERM" ? 128 + 15 : signal === "SIGINT" ? 128 + 2 : 0
      process.exit(code)
    })
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

/**
 * The top-level chain class.
 *
 * Mutable by design — every method returns `this`. Once `.build()` or
 * `.listen()` has produced a `HyperApp`, subsequent mutations transparently
 * invalidate the cache and rebuild on next access.
 */
export class Hyper<Ctx extends AppContext = AppContext> {
  /** Duck-typed brand so CLI tooling can recognize a `Hyper` across package boundaries. */
  readonly __hyperBuilder__ = true

  readonly #prefix: string
  readonly #options: HyperOptions
  readonly #routes: Route[] = []
  readonly #middleware: Middleware[] = []
  readonly #decorators: DecorateFactory[] = []
  readonly #derives: DeriveFactory[] = []
  readonly #plugins: HyperPlugin[] = []
  #routerConfig?: PlainRouterConfig
  #envConfig?: EnvConfigLike
  #securityOverrides: Partial<SecurityDefaults> = {}
  #built: HyperApp | undefined
  #server: Server<unknown> | undefined

  constructor(opts: HyperOptions = {}) {
    this.#prefix = normalizePrefix(opts.prefix ?? "")
    this.#options = opts
    if (opts.security) this.#securityOverrides = { ...opts.security }
    if (opts.env !== undefined) this.#envConfig = opts.env
  }

  // -----------------------------------------------------------------
  // Introspection
  // -----------------------------------------------------------------

  /** The normalized prefix (e.g. "/users"). Empty string when unset. */
  get prefix(): string {
    return this.#prefix
  }

  /** The live `Bun.Server` — populated after `.listen()`. */
  get server(): Server<unknown> | undefined {
    return this.#server
  }

  /** Display name (for banners / diagnostics). */
  get name(): string {
    return this.#options.name ?? "hyper"
  }

  /** Raw route list — forwards to the built app. */
  get routeList(): readonly Route[] {
    return this.build().routeList
  }

  /** `Bun.serve({ routes })` compatible map — forwards to the built app. */
  get routes(): BunRoutes {
    return this.build().routes
  }

  /** fetch-compatible entry point for any Bun/edge/workers adapter. */
  get fetch(): (req: Request) => Promise<Response> {
    return this.build().fetch
  }

  // -----------------------------------------------------------------
  // Verb shortcuts
  // -----------------------------------------------------------------

  get<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  get<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  get(path: string, body: string): this
  get(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("GET", path, a, b)
  }
  post<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  post<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  post(path: string, body: string): this
  post(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("POST", path, a, b)
  }
  put<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  put<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  put(path: string, body: string): this
  put(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("PUT", path, a, b)
  }
  patch<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  patch<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  patch(path: string, body: string): this
  patch(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("PATCH", path, a, b)
  }
  delete<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  delete<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  delete(path: string, body: string): this
  delete(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("DELETE", path, a, b)
  }
  head<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  head<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  head(path: string, body: string): this
  head(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("HEAD", path, a, b)
  }
  options<Path extends string>(path: Path, handler: VerbHandler<Path, undefined, Ctx>): this
  options<Path extends string, const O extends RouteOpts>(
    path: Path,
    opts: O,
    handler: VerbHandler<Path, O, Ctx>,
  ): this
  options(path: string, body: string): this
  options(path: string, a: unknown, b?: unknown): this {
    return this.#addRoute("OPTIONS", path, a, b)
  }

  // -----------------------------------------------------------------
  // Composition
  // -----------------------------------------------------------------

  /** Register a plain-object router. Nested keys become a group tree. */
  router(cfg: PlainRouterConfig): this {
    this.#invalidate()
    // Delegate to fromPlainRouter; the prefix flow mirrors sub-app use.
    const g = fromPlainRouter(cfg as never, "")
    for (const r of g.build().routes) {
      this.#routes.push(this.#prefixAndWrap(r, ""))
    }
    // Keep a reference so the raw router config is still available to
    // tooling that inspects `app.__config.router` (e.g. typed clients).
    this.#routerConfig = cfg
    return this
  }

  /** Polymorphic `.use()` — see {@link UseArg}. */
  // biome-ignore lint/suspicious/noExplicitAny: sub-app Ctx is opaque at this boundary
  use(prefix: string, sub: Hyper<any>): this
  use(arg: UseArg): this
  use(arg1: unknown, arg2?: unknown): this {
    this.#invalidate()

    // Two-arg form: (prefix, sub-app)
    if (typeof arg1 === "string") {
      if (!(arg2 instanceof Hyper)) {
        throw new Error("Hyper.use(prefix, sub): the second argument must be a Hyper instance.")
      }
      return this.#useSubApp(arg2, normalizePrefix(arg1))
    }

    const arg = arg1
    if (arg instanceof Hyper) return this.#useSubApp(arg, "")
    if (arg instanceof GroupBuilder) return this.#useGroup(arg.build())
    if (isRouteGroup(arg)) return this.#useGroup(arg)
    if (isRoute(arg)) return this.#useRoutes([arg])
    if (Array.isArray(arg) && arg.every(isRoute)) return this.#useRoutes(arg as readonly Route[])
    if (isHyperPlugin(arg)) {
      this.#plugins.push(arg)
      return this
    }
    if (typeof arg === "function") {
      this.#middleware.push(arg as Middleware)
      return this
    }
    // ESM namespace / plain object → walk for Route-shaped values.
    if (typeof arg === "object" && arg !== null) {
      return this.#useNamespace(arg as Record<string, unknown>)
    }

    throw new Error(
      "Hyper.use: unsupported argument. Accepts Hyper sub-app, GroupBuilder, RouteGroup, Route(s), HyperPlugin, Middleware, or ESM namespace.",
    )
  }

  /** Mount a single plugin by name. Identical to `.use(plugin)`. */
  plugin(p: HyperPlugin): this {
    this.#invalidate()
    this.#plugins.push(p)
    return this
  }

  /**
   * Static context decoration (db, redis, caches) — constructed once at boot.
   * Returns a `Hyper` with the widened `Ctx` so downstream handlers see the
   * added shape without casting.
   */
  decorate<A extends object>(factory: (env?: unknown) => A | Promise<A>): Hyper<Ctx & Readonly<A>> {
    this.#invalidate()
    this.#decorators.push(factory as DecorateFactory)
    return this as unknown as Hyper<Ctx & Readonly<A>>
  }

  /**
   * Per-request context derivation. Runs once per request, after decorators
   * and before the handler. Returned fields merge into `ctx` and are visible
   * to the handler with full type inference.
   */
  derive<A extends object>(
    factory: (args: { ctx: Ctx; env?: unknown; req: Request }) => A | Promise<A>,
  ): Hyper<Ctx & Readonly<A>> {
    this.#invalidate()
    this.#derives.push(factory as unknown as DeriveFactory)
    return this as unknown as Hyper<Ctx & Readonly<A>>
  }

  /** Declare env schema. Parsed at boot; `parseEnv` throws on bad input. */
  env(cfg: EnvConfigLike): this {
    this.#invalidate()
    this.#envConfig = cfg
    return this
  }

  /** Partial overrides over the secure-by-default baseline. */
  security(overrides: Partial<SecurityDefaults>): this {
    this.#invalidate()
    this.#securityOverrides = { ...this.#securityOverrides, ...overrides }
    return this
  }

  // -----------------------------------------------------------------
  // Build / listen
  // -----------------------------------------------------------------

  /**
   * Construct (and memoize) the underlying `HyperApp`. Safe to call
   * many times; re-runs only when chain state has been mutated since
   * the last call.
   */
  build(): HyperApp {
    if (this.#built) return this.#built
    const config: AppConfig = {
      routes: this.#routes,
      plugins: this.#plugins,
      decorate: this.#decorators,
      derive: this.#derives,
      ...(this.#envConfig && { env: this.#envConfig }),
      security: this.#securityOverrides,
      ...(this.#routerConfig && { router: this.#routerConfig }),
    }
    this.#built = app(config)
    return this.#built
  }

  /**
   * Boot a real `Bun.serve` unless `process.env.HYPER_SKIP_LISTEN` is
   * set. Returns `this` so the chain can still be exported cleanly:
   *
   *   export default new Hyper().get("/", () => "hi").listen(3000)
   */
  listen(portOrOpts?: number | ListenOptions): this {
    const built = this.build()

    if (process.env.HYPER_SKIP_LISTEN) return this

    const opts: ListenOptions =
      typeof portOrOpts === "number" ? { port: portOrOpts } : (portOrOpts ?? {})
    const isProd = process.env.NODE_ENV === "production"
    const port = opts.port ?? Number(process.env.PORT ?? 3000)
    const hostname = opts.hostname ?? (isProd ? "0.0.0.0" : "localhost")
    const idleTimeout = opts.idleTimeout ?? 10
    const development = opts.development ?? !isProd
    const bannerOn = opts.banner ?? !isProd
    const drainOn = opts.drain !== false

    this.#server = Bun.serve({
      port,
      hostname,
      routes: built.routes,
      fetch: built.fetch,
      idleTimeout,
      development,
    })

    if (bannerOn) {
      const n = built.routeList.length
      const plural = n === 1 ? "route" : "routes"
      console.log(
        `${this.name} ${HYPER_VERSION} listening on http://${this.#server.hostname}:${this.#server.port} (${n} ${plural})`,
      )
    }

    if (drainOn) {
      activeServers.add(this)
      installDrainHandlersOnce()
    }

    return this
  }

  /**
   * Stop the live server. `drain` (default true) waits for in-flight
   * requests; pass `false` to immediately force-close.
   */
  async stop(drain = true): Promise<void> {
    const s = this.#server
    if (!s) return
    activeServers.delete(this)
    this.#server = undefined
    await s.stop(!drain)
  }

  // -----------------------------------------------------------------
  // HyperApp proxies
  // -----------------------------------------------------------------

  invoke(input: InvokeInput): Promise<InvokeResult> {
    return this.build().invoke(input)
  }
  toOpenAPI(cfg?: Parameters<HyperApp["toOpenAPI"]>[0]): ReturnType<HyperApp["toOpenAPI"]> {
    return this.build().toOpenAPI(cfg)
  }
  toMCPManifest(): ReturnType<HyperApp["toMCPManifest"]> {
    return this.build().toMCPManifest()
  }
  toClientManifest(): ReturnType<HyperApp["toClientManifest"]> {
    return this.build().toClientManifest()
  }
  test(overrides?: TestOverrides): HyperApp {
    return this.build().test(overrides)
  }

  // -----------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------

  #invalidate(): void {
    this.#built = undefined
  }

  #addRoute(
    method: HttpMethod,
    path: string,
    optsOrHandler: unknown,
    maybeHandler?: unknown,
  ): this {
    this.#invalidate()

    // String shortcut: `.get("/", "Hello")` → .staticResponse(new Response("Hello"))
    if (typeof optsOrHandler === "string" && maybeHandler === undefined) {
      const fullPath = joinPaths(this.#prefix, path)
      const r = this.#verbBuilder(method, fullPath).staticResponse(
        new Response(optsOrHandler),
      ) as Route
      this.#routes.push(r)
      return this
    }

    let opts: RouteOpts | undefined
    let handler: (ctx: HandlerCtx) => HandlerReturn | Promise<HandlerReturn>
    if (maybeHandler !== undefined) {
      opts = optsOrHandler as RouteOpts
      handler = maybeHandler as (ctx: HandlerCtx) => HandlerReturn | Promise<HandlerReturn>
    } else {
      handler = optsOrHandler as (ctx: HandlerCtx) => HandlerReturn | Promise<HandlerReturn>
    }

    const fullPath = joinPaths(this.#prefix, path)
    let builder: RouteBuilder = this.#verbBuilder(method, fullPath)

    if (opts) {
      if (opts.params) builder = builder.params(opts.params)
      if (opts.query) builder = builder.query(opts.query)
      if (opts.body) builder = builder.body(opts.body)
      if (opts.headers) builder = builder.headers(opts.headers)
      if (opts.meta) builder = builder.meta(opts.meta)
      if (opts.throws) builder = builder.throws(opts.throws)
      if (opts.errors) builder = builder.errors(opts.errors)
      if (opts.use) for (const mw of opts.use) builder = builder.use(mw)
    }

    // Instance-level middleware is applied AFTER per-route opts, so the
    // chain order is: instance-mw → route-opts-mw → handler. Same
    // intuition as Express: parent-scoped mw wraps inner.
    for (const mw of this.#middleware) builder = builder.use(mw)

    const r = builder.handle(handler)
    this.#routes.push(r)
    return this
  }

  #verbBuilder(method: HttpMethod, path: string): RouteBuilder {
    switch (method) {
      case "GET":
        return route.get(path)
      case "POST":
        return route.post(path)
      case "PUT":
        return route.put(path)
      case "PATCH":
        return route.patch(path)
      case "DELETE":
        return route.delete(path)
      case "HEAD":
        return route.head(path)
      case "OPTIONS":
        return route.options(path)
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous sub-app Ctx
  #useSubApp(sub: Hyper<any>, extraPrefix: string): this {
    // Use the sub-app's already-built route list — its own prefix
    // (from `new Hyper({ prefix })`) is already baked into each path.
    const built = sub.build()
    for (const r of built.routeList) {
      this.#routes.push(this.#prefixAndWrap(r, extraPrefix))
    }
    return this
  }

  #useGroup(g: RouteGroup): this {
    // A RouteGroup has its prefix already baked into each route's path.
    for (const r of g.routes) {
      this.#routes.push(this.#prefixAndWrap(r, ""))
    }
    return this
  }

  #useRoutes(routes: readonly Route[]): this {
    for (const r of routes) {
      this.#routes.push(this.#prefixAndWrap(r, ""))
    }
    return this
  }

  #useNamespace(ns: Record<string, unknown>): this {
    // Walk the namespace for Route-shaped values, applying this prefix
    // + current middleware stack to each. Nested objects recurse.
    for (const value of Object.values(ns)) {
      if (isRoute(value)) {
        this.#routes.push(this.#prefixAndWrap(value, ""))
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // Guard against walking primitives or circular structures. A
        // typical ESM namespace only contains a single level of Routes.
        this.#useNamespace(value as Record<string, unknown>)
      }
    }
    return this
  }

  #prefixAndWrap(r: Route, extra: string): Route {
    const combined = joinPaths(joinPaths(this.#prefix, extra), r.path)
    if (combined === r.path && this.#middleware.length === 0) return r
    if (this.#middleware.length === 0) return { ...r, path: combined }
    const chain: ChainRunner = compileChain(this.#middleware.slice())
    const wrapped: RouteHandler = (ictx: InternalHandlerCtx) =>
      chain(
        {
          ctx: ictx.ctx,
          input: {
            params: ictx.params,
            query: ictx.query,
            body: ictx.body,
            headers: ictx.headers,
          },
          req: ictx.req,
          path: combined,
          params: ictx.params,
        },
        () => r.handler(ictx),
      ) as ReturnType<RouteHandler>
    return { ...r, path: combined, handler: wrapped }
  }
}

/**
 * `hyper(opts?)` — factory alias for `new Hyper(opts)`. Returns the
 * same class instance, so `instanceof Hyper` continues to work.
 */
export function hyper(opts?: HyperOptions): Hyper {
  return new Hyper(opts)
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * Combine two path segments, matching Elysia's "prefix = /users, path
 * = /" → "/users" intuition. Whichever segment is empty is dropped; a
 * path of "/" at the tail collapses to the prefix.
 */
export function joinPaths(prefix: string, rest: string): string {
  const p = prefix === "" || prefix === "/" ? "" : prefix
  const r = rest === "" || rest === "/" ? "" : rest.startsWith("/") ? rest : `/${rest}`
  if (p === "" && r === "") return "/"
  if (p === "") return r
  if (r === "") return p
  return `${p}${r}`
}

function normalizePrefix(p: string): string {
  if (p === "" || p === "/") return ""
  let out = p.startsWith("/") ? p : `/${p}`
  if (out.endsWith("/")) out = out.slice(0, -1)
  return out
}

function isRoute(x: unknown): x is Route {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as Route).method === "string" &&
    typeof (x as Route).path === "string" &&
    typeof (x as Route).handler === "function" &&
    typeof (x as Route).kind === "string"
  )
}

function isRouteGroup(x: unknown): x is RouteGroup {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as RouteGroup).prefix === "string" &&
    Array.isArray((x as RouteGroup).routes)
  )
}

function isHyperPlugin(x: unknown): x is HyperPlugin {
  if (typeof x !== "object" || x === null) return false
  if (typeof (x as HyperPlugin).name !== "string") return false
  // A plugin isn't a route (would collide on `.handler`/`.method`).
  if (isRoute(x)) return false
  return true
}
