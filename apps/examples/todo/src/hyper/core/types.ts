/**
 * Public types for @hyper/core.
 *
 * Kept in a single file so declaration merging surfaces (AppContext,
 * RouteMeta, ErrorRegistry) are easy to locate and re-export.
 */

import type { StandardSchemaV1 } from "./standard-schema.ts"

/** HTTP verbs supported by the builder. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"

/**
 * Consumer-augmentable app context. Decorate/derive/plugins populate
 * this via `declare module "@hyper/core" { interface AppContext { ... } }`.
 *
 * Declared as an empty `interface` (not `type = {}`) so that TypeScript
 * honors declaration-merging: every `declare module` contribution adds
 * fields to this shape. Unlike `type = {}`, which matches any non-null
 * value and silently accepts garbage, `interface AppContext {}` enforces
 * the augmented shape in consumer code.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentable declaration-merging surface
// biome-ignore lint/complexity/noBannedTypes: interface is the correct primitive here
export interface AppContext {}

/** A per-route example — surfaced to OpenAPI, MCP few-shot, client JSDoc, tests. */
export interface RouteExample {
  readonly name: string
  readonly input?: {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
    body?: unknown
    headers?: Record<string, unknown>
  }
  readonly output?: {
    status?: number
    body?: unknown
  }
}

/** Per-route metadata (OpenAPI, MCP, auth tags, etc.). Augmentable. */
export interface RouteMeta {
  /** Human-readable name. */
  name?: string
  /** Free-form tags; plugins may filter on these. */
  tags?: readonly string[]
  /** Set by `@hyper/mcp`; if absent, the route is not MCP-exposed. */
  mcp?: false | { description: string; [k: string]: unknown }
  /** Reserved for internal tooling (dev MCP etc.). Never projected. */
  internal?: boolean
  /** CSRF on/off for cookie-auth routes. Default: on. */
  csrf?: boolean
  /** Marks auth-endpoint routes for the default rate-limit recipe. */
  authEndpoint?: boolean
  /** Caller-defined overrides to response headers. */
  headers?: Record<string, string>
  /** Marks the route as deprecated — surfaces in OpenAPI + Sunset header. */
  deprecated?: boolean | { readonly reason?: string; readonly sunset?: string }
  /** API version for header/prefix-based routing. */
  version?: string
  /** Server action marker (`.actionable()`). */
  action?: boolean
  /** Per-route hard timeout in milliseconds. Overrides `security.requestTimeoutMs`. */
  timeoutMs?: number
  /** Examples — OpenAPI, MCP few-shot, client JSDoc, contract tests. */
  examples?: readonly RouteExample[]
  [k: string]: unknown
}

/**
 * Named error codes catalog per route. Augmentable via declaration
 * merging (same pattern as {@link AppContext}).
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentable declaration-merging surface
// biome-ignore lint/complexity/noBannedTypes: interface is the correct primitive here
export interface ErrorRegistry {}

/** The shape returned from every parsing step — Standard Schema aligned. */
export type Infer<S> = S extends StandardSchemaV1<unknown, infer O> ? O : unknown

/** A Hyper response can be a real `Response`, a `Bun.file`, or bare data. */
export type HandlerReturn =
  | Response
  | BunFileLike
  | object
  | string
  | number
  | boolean
  | null
  | ReadableStream
  | AsyncIterable<string | Uint8Array>
  | undefined

/** Marker for anything coercible by our response layer (Bun.file(...)). */
export interface BunFileLike {
  readonly stream: () => ReadableStream
  readonly type?: string
  readonly size?: number
  readonly name?: string
}

/** A compiled route — the normalized shape the app and router consume. */
export interface Route<M extends HttpMethod = HttpMethod> {
  readonly method: M
  readonly path: string
  readonly params?: StandardSchemaV1
  readonly query?: StandardSchemaV1
  readonly body?: StandardSchemaV1
  readonly headers?: StandardSchemaV1
  readonly meta: RouteMeta
  readonly handler: RouteHandler
  /** Declared thrown-error shapes keyed by HTTP status (projection surface). */
  readonly throws?: Record<number, StandardSchemaV1>
  /** Named error-code catalog (projection surface). */
  readonly errors?: Record<string, StandardSchemaV1>
  /** True when the handler is a function (not a pre-built Response). */
  readonly kind: "fn" | "static"
  /** Optional compile-time-static Response for fast path. */
  readonly staticResponse?: Response
  /**
   * Tags for every middleware attached to this route, in order. Middleware
   * opts in by setting `fn.__hyperTag = "<name>"`. Consumed by
   * `hyper security --check` and other introspection tools.
   */
  readonly middlewareTags?: readonly string[]
}

/** The internal handler shape after builder normalization. */
export type RouteHandler = (ctx: InternalHandlerCtx) => Promise<HandlerReturn> | HandlerReturn

/**
 * Context passed into the handler — a superset the framework builds.
 *
 * `url`, `query`, `headers`, and `responseHeaders` are lazy: they're
 * materialized only when the handler reads them. When a route
 * declares a `.query()` / `.headers()` schema the pipeline sets the
 * parsed plain object as an own property (shadowing the lazy getter).
 * `query` / `headers` therefore hold whatever the handler expects —
 * typically a parsed record or `Record<string, string>` for the
 * schema-less case.
 */
export interface InternalHandlerCtx {
  readonly req: Request
  readonly url: URL
  readonly params: Record<string, string>
  readonly query: unknown
  readonly headers: unknown
  readonly body: unknown
  /** Populated by plugin.context / decorate / derive. */
  readonly ctx: AppContext
  /** Lazy Bun.CookieMap accessor — parse on first touch. */
  readonly cookies: () => import("bun").CookieMap
  /** Mutable response header bag; flushed into the final Response. */
  readonly responseHeaders: Headers
}

/** A decorator factory — produces static context from the parsed env. */
export type DecorateFactory<Env = unknown, Added extends object = object> = (
  env: Env,
) => Added | Promise<Added>

/** A derive factory — produces per-request context from ctx + env + req. */
export type DeriveFactory<
  Env = unknown,
  CtxIn extends AppContext = AppContext,
  Added extends object = object,
> = (args: { ctx: CtxIn; env: Env; req: Request }) => Added | Promise<Added>

/** Input accepted for `AppConfig.groups` — matches the GroupBuilder shape. */
export interface GroupConfigEntry {
  /** The flattened build output consumed by `app()`. */
  build(): RouteGroup
}

/** A plain-object router; nested records of routes or sub-routers. */
export interface PlainRouterConfig {
  readonly [key: string]: Route | PlainRouterConfig
}

/** App-level config. */
export interface AppConfig {
  /** Collected top-level routes. */
  readonly routes?: readonly Route[]
  /** Collected groups (flattened at app()). Accepts `GroupBuilder`s or `RouteGroup` literals. */
  readonly groups?: readonly (GroupConfigEntry | RouteGroup)[]
  /** Plain-object router (gives the typed-client tree). */
  readonly router?: PlainRouterConfig
  /** Feature flags for security defaults. On by default. */
  readonly security?: Partial<SecurityDefaults>
  /** Env schema + secrets + source. */
  readonly env?: EnvConfigLike
  /** Static context decoration (db, redis, etc.) constructed at boot. */
  readonly decorate?: readonly DecorateFactory[]
  /** Per-request derived context. */
  readonly derive?: readonly DeriveFactory[]
  /** Plugins installed in priority order. */
  readonly plugins?: readonly HyperPlugin[]
}

/** Plugin surface for extending `app()` with lifecycle hooks and ctx decoration. */
export interface HyperPlugin {
  readonly name: string
  readonly build?: (app: HyperApp) => void | Promise<void>
  readonly request?: {
    /**
     * Fires BEFORE route matching. Returning a Response short-circuits
     * the rest of the pipeline — ideal for CORS preflight and auth gates.
     */
    readonly preRoute?: (args: {
      req: Request
    }) => Response | undefined | Promise<Response | undefined>
    readonly before?: (args: {
      req: Request
      ctx: AppContext
      route?: Route
    }) => void | Promise<void>
    readonly after?: (args: {
      req: Request
      ctx: AppContext
      res: Response
      route?: Route
    }) => void | Promise<void>
    readonly onError?: (args: {
      req: Request
      ctx: AppContext
      error: unknown
      route?: Route
    }) => void | Promise<void>
  }
  readonly context?: (env: unknown) => object | Promise<object>
}

export interface EnvConfigLike {
  readonly schema?: unknown
  readonly secrets?: readonly string[]
  readonly source?: Record<string, string | undefined>
}

/** A single invocation — the shared path between HTTP/MCP/RPC/actions. */
export interface InvokeInput {
  readonly method: HttpMethod
  readonly path: string
  readonly params?: Record<string, string>
  readonly query?: Record<string, unknown>
  readonly body?: unknown
  readonly headers?: Record<string, string>
  /** Optional pre-set AppContext (bypasses decorate/derive). Useful for tests. */
  readonly ctx?: AppContext
}

export interface InvokeResult {
  readonly status: number
  readonly data: unknown
  readonly headers: Headers
}

/** The built app surface. */
export interface HyperApp {
  /** fetch-compatible entry point for any Bun/edge/workers adapter. */
  readonly fetch: (req: Request) => Promise<Response>
  /** Bun.serve({ routes }) shape — static + dynamic routes mounted natively. */
  readonly routes: BunRoutes
  /** Raw route list for introspection. */
  readonly routeList: readonly Route[]
  /** Shared invoke path — HTTP/MCP/RPC/actions all funnel here. */
  readonly invoke: (input: InvokeInput) => Promise<InvokeResult>
  /** OpenAPI 3.1 serializer (schema conversion provided by @hyper/openapi). */
  readonly toOpenAPI: (cfg?: {
    title?: string
    version?: string
    description?: string
  }) => import("./projection.ts").OpenAPIManifest
  /** MCP manifest. @hyper/mcp adds the transport. */
  readonly toMCPManifest: () => import("./projection.ts").MCPManifest
  /** Client manifest. @hyper/client consumes this. */
  readonly toClientManifest: () => import("./projection.ts").ClientManifest
  /** Original AppConfig — used by `app.test()` to produce scoped clones. */
  readonly __config: AppConfig
  /**
   * Create a test-scoped clone. Replaces env/decorate/derive and can skip
   * or swap plugins by name. Returns a fresh immutable app.
   */
  readonly test: (overrides?: TestOverrides) => HyperApp
}

/** Overrides accepted by `app.test()`. */
export interface TestOverrides {
  /** Replace env source values (merged into config.env.source). */
  readonly env?: Record<string, string | undefined>
  /** Additional decorators appended to config.decorate. */
  readonly decorate?: DecorateFactory | readonly DecorateFactory[]
  /** Additional derive functions appended to config.derive. */
  readonly derive?: DeriveFactory | readonly DeriveFactory[]
  /** Plugins to skip (by name) or replace (by name → new plugin). */
  readonly plugins?: {
    readonly skip?: readonly string[]
    readonly replace?: Record<string, HyperPlugin>
    readonly add?: readonly HyperPlugin[]
  }
}

/** One mounted-route value in `Bun.serve({ routes })`. */
export type BunRouteValue =
  | Response
  | Record<string, Response>
  | ((req: Request) => Response | Promise<Response>)

/** The Bun.serve routes map shape. See https://bun.sh/docs/api/http#routing. */
export type BunRoutes = Record<string, BunRouteValue>

/** A RouteGroup is a collection of routes with a shared prefix. */
export interface RouteGroup {
  readonly prefix: string
  readonly routes: readonly Route[]
}

/** Security defaults — see ./security.ts for wire values. */
export interface SecurityDefaults {
  readonly headers: boolean
  readonly bodyLimitBytes: number
  readonly rejectProtoKeys: boolean
  readonly serverHeader: false
  /**
   * When true, a request carrying `X-HTTP-Method-Override` or
   * `_method` is rejected with 400. Default: true. Prevents a class of
   * CSRF/verb-smuggling bugs where attackers bypass safe-method checks.
   */
  readonly rejectMethodOverride: boolean
  /**
   * Hard request timeout in ms. The framework aborts the handler and
   * returns 504 if a response isn't produced in time. 0 disables.
   * Default: 30_000 (30s).
   */
  readonly requestTimeoutMs: number
  /**
   * Explicit env that allows Hyper to emit HSTS. Default: "production".
   * HSTS is never emitted for HTTP, and only emitted for HTTPS when the
   * current NODE_ENV (or provided `env`) matches. Prevents accidental
   * HSTS pinning on dev domains.
   */
  readonly hstsEnv: string | false
}
