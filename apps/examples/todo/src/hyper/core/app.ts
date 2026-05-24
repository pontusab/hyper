/**
 * app() — builds a HyperApp from routes, groups, plugins, env, decorate.
 *
 * Boot order:
 *   1. Merge env layers → typed env (throws on bad input with why/fix).
 *   2. Run every decorate(env) → static ctx (singletons like db).
 *   3. Run plugin.build(app) / plugin.context(env) → merge into static ctx.
 *   4. Wire request pipeline: derive(ctx) per-request, plugins.before/after.
 *
 * The app is opaque for end users — everything goes through `.fetch`.
 */

import { type ContextBlueprint, applyDerive, resolveStaticContext } from "./decorate.ts"
import { parseEnv, withEnv } from "./env.ts"
import { HyperError, asHyperError } from "./error.ts"
import { GroupBuilder, fromPlainRouter } from "./group.ts"
import {
  type ClientManifest,
  type MCPManifest,
  type OpenAPIManifest,
  type OpenAPIManifestConfig,
  toClientManifest,
  toMCPManifest,
  toOpenAPI,
} from "./projection.ts"
import { parseBodyAuto } from "./request.ts"
import { coerce, errorResponse } from "./response.ts"
import { Router } from "./router.ts"
import {
  DEFAULT_SECURITY,
  METHOD_OVERRIDE_HEADERS,
  METHOD_OVERRIDE_QUERY_KEYS,
  applyDefaultHeaders,
} from "./security.ts"
import { SchemaValidationError, type StandardSchemaV1, parseStandard } from "./standard-schema.ts"
import type {
  AppConfig,
  AppContext,
  BunRoutes,
  HyperApp,
  HyperPlugin,
  InternalHandlerCtx,
  InvokeInput,
  InvokeResult,
  Route,
  SecurityDefaults,
} from "./types.ts"

export function app(config: AppConfig = {}): HyperApp {
  const security: SecurityDefaults = { ...DEFAULT_SECURITY, ...config.security }

  // 1. Collect routes -------------------------------------------------------
  const allRoutes: Route[] = []
  if (config.routes) allRoutes.push(...config.routes)
  if (config.groups) {
    for (const g of config.groups) {
      // Accept either a GroupBuilder (has .build()) or a RouteGroup literal.
      const built: import("./types.ts").RouteGroup =
        typeof (g as { build?: unknown }).build === "function"
          ? (g as import("./types.ts").GroupConfigEntry).build()
          : (g as import("./types.ts").RouteGroup)
      for (const r of built.routes) allRoutes.push(r)
    }
  }
  if (config.router) {
    const built = fromPlainRouter(config.router).build()
    for (const r of built.routes) allRoutes.push(r)
  }

  const router = new Router()
  for (const r of allRoutes) router.add(r)

  // 2. Env (lazy — the first request triggers boot). In a real app, boot
  //    should be eager; but keeping it lazy makes the library usable in
  //    edge/test environments where no process.env is available.
  //
  //    Once boot resolves, we cache the state directly and bypass the
  //    promise on subsequent requests — the hot path becomes sync.
  let bootedPromise: Promise<BootedState> | undefined
  let bootedCache: BootedState | undefined
  let bootedError: unknown
  const plugins: readonly HyperPlugin[] = config.plugins ?? []

  // Precompute per-hook plugin arrays so the request pipeline skips
  // any hook category that has zero installed callbacks — no empty
  // `for (const p of plugins)` loops on the hot path.
  const pluginsPreRoute: readonly HyperPlugin[] = plugins.filter((p) => p.request?.preRoute)
  const pluginsBefore: readonly HyperPlugin[] = plugins.filter((p) => p.request?.before)
  const pluginsAfter: readonly HyperPlugin[] = plugins.filter((p) => p.request?.after)
  const pluginsOnError: readonly HyperPlugin[] = plugins.filter((p) => p.request?.onError)

  // Whether the app declares any env schema. When false we skip the
  // AsyncLocalStorage (`withEnv`) wrapping per request — saves a Map
  // alloc + ALS snapshot per fetch on plaintext-style routes.
  const envRequired = config.env?.schema !== undefined

  const boot = async (): Promise<BootedState> => {
    const envLayers: StandardSchemaV1[] = []
    if (config.env?.schema) envLayers.push(config.env.schema as StandardSchemaV1)
    const env = await parseEnv(envLayers, config.env?.source)

    const blueprint: ContextBlueprint = {
      decorators: config.decorate ?? [],
      derives: config.derive ?? [],
    }
    const { ctx: staticCtx, dispose } = await resolveStaticContext(blueprint, env)

    // Plugin-installed context
    for (const p of plugins) {
      if (p.context) {
        const added = await p.context(env)
        Object.assign(staticCtx, added)
      }
      if (p.build) await p.build(instance)
    }

    return { env, staticCtx, dispose, blueprint }
  }

  const fetch = async (req: Request): Promise<Response> => {
    let booted = bootedCache
    if (!booted) {
      if (bootedError) {
        return finalize(errorResponse(asHyperError(bootedError)), isHttps(req), security)
      }
      if (!bootedPromise) {
        bootedPromise = boot().then(
          (s) => {
            bootedCache = s
            return s
          },
          (e) => {
            bootedError = e
            throw e
          },
        )
      }
      try {
        booted = await bootedPromise
      } catch (e) {
        return finalize(errorResponse(asHyperError(e)), isHttps(req), security)
      }
    }
    const hooks: HookPlugins = {
      preRoute: pluginsPreRoute,
      before: pluginsBefore,
      after: pluginsAfter,
      onError: pluginsOnError,
    }
    // Skip the AsyncLocalStorage wrap when no env schema is declared —
    // `useEnv()` is opt-in so the cost is unjustified on plaintext
    // throughput benchmarks that never call it.
    if (!envRequired) return handleRequest(req, booted, router, security, hooks)
    return withEnv(booted.env, () => handleRequest(req, booted!, router, security, hooks))
  }

  const routes = buildBunRoutes(allRoutes, fetch)

  const invoke = async (input: InvokeInput): Promise<InvokeResult> => {
    const rawPath = input.path.startsWith("/") ? input.path : `/${input.path}`
    const resolvedPath = input.params
      ? rawPath.replace(/:([A-Za-z0-9_]+)/g, (_, k: string) => {
          const v = input.params?.[k]
          if (v === undefined) throw new Error(`invoke: missing path param :${k}`)
          return encodeURIComponent(v)
        })
      : rawPath
    const url = new URL(`http://local${resolvedPath}`)
    if (input.query) {
      for (const [k, v] of Object.entries(input.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }
    }
    const init: RequestInit = {
      method: input.method,
      ...(input.headers ? { headers: input.headers } : {}),
      ...(input.body !== undefined && hasBody(input.method)
        ? {
            body: typeof input.body === "string" ? input.body : JSON.stringify(input.body),
            headers: {
              "content-type": "application/json",
              ...(input.headers ?? {}),
            },
          }
        : {}),
    }
    const req = new Request(url, init)
    const res = await fetch(req)
    const ct = res.headers.get("content-type") ?? ""
    const data = ct.includes("application/json") ? await res.json() : await res.text()
    return { status: res.status, data, headers: res.headers }
  }

  const toOpenAPIFn = (cfg: OpenAPIManifestConfig = {}): OpenAPIManifest =>
    toOpenAPI(allRoutes, cfg)
  const toMCPFn = (): MCPManifest => toMCPManifest(allRoutes)
  const toClientFn = (): ClientManifest => toClientManifest(allRoutes)

  const instance: HyperApp = {
    fetch,
    routes,
    routeList: Object.freeze([...allRoutes]),
    invoke,
    toOpenAPI: toOpenAPIFn,
    toMCPManifest: toMCPFn,
    toClientManifest: toClientFn,
    __config: config,
    test: (overrides = {}) => makeTestApp(config, overrides),
  }
  return instance
}

function makeTestApp(base: AppConfig, overrides: import("./types.ts").TestOverrides): HyperApp {
  // Merge env: original source + overrides.env (overrides win).
  const env: AppConfig["env"] | undefined = base.env
    ? {
        ...base.env,
        source: { ...(base.env.source ?? {}), ...(overrides.env ?? {}) },
      }
    : overrides.env !== undefined
      ? { source: { ...overrides.env } }
      : base.env

  const addDecorators = toArray(overrides.decorate)
  const decorate =
    addDecorators.length > 0 ? [...(base.decorate ?? []), ...addDecorators] : base.decorate

  const addDerives = toArray(overrides.derive)
  const derive = addDerives.length > 0 ? [...(base.derive ?? []), ...addDerives] : base.derive

  let plugins = base.plugins ?? []
  if (overrides.plugins) {
    const { skip = [], replace = {}, add = [] } = overrides.plugins
    plugins = plugins
      .filter((p) => !skip.includes(p.name))
      .map((p) => replace[p.name] ?? p)
      .concat(add)
  }

  return app({
    ...base,
    ...(env !== undefined && { env }),
    ...(decorate !== undefined && { decorate }),
    ...(derive !== undefined && { derive }),
    plugins,
  })
}

function toArray<T>(x: T | readonly T[] | undefined): readonly T[] {
  if (x === undefined) return []
  return Array.isArray(x) ? (x as readonly T[]) : [x as T]
}

interface BootedState {
  readonly env: Record<string, unknown>
  readonly staticCtx: Record<string, unknown>
  readonly dispose: () => Promise<void>
  readonly blueprint: ContextBlueprint
}

interface HookPlugins {
  readonly preRoute: readonly HyperPlugin[]
  readonly before: readonly HyperPlugin[]
  readonly after: readonly HyperPlugin[]
  readonly onError: readonly HyperPlugin[]
}

async function handleRequest(
  req: Request,
  booted: BootedState,
  router: Router,
  security: SecurityDefaults,
  hooks: HookPlugins,
): Promise<Response> {
  // Pathname is extracted via indexOf — we never allocate a URL on the
  // routing hot path. URL is only built on-demand if the handler reads
  // `ctx.url` (via a lazy prototype getter on the handler ctx).
  const rawUrl = req.url
  const pathname = extractPathname(rawUrl)
  const https = isHttps(req)

  // Method-override guard — refuse to reinterpret the verb from headers
  // or query string. CSRF attackers love these; Hyper never honors them.
  if (security.rejectMethodOverride) {
    const headers = req.headers
    for (let i = 0; i < METHOD_OVERRIDE_HEADERS.length; i++) {
      const h = METHOD_OVERRIDE_HEADERS[i]!
      if (headers.has(h)) return finalize(methodOverrideRejected(h), https, security)
    }
    for (let i = 0; i < METHOD_OVERRIDE_QUERY_KEYS.length; i++) {
      const q = METHOD_OVERRIDE_QUERY_KEYS[i]!
      if (urlHasQueryKey(rawUrl, q)) return finalize(methodOverrideRejected(q), https, security)
    }
  }

  // Plugin pre-route hooks may short-circuit (CORS preflight, etc.)
  // before routing, so OPTIONS on unregistered paths still works.
  if (hooks.preRoute.length > 0) {
    for (const p of hooks.preRoute) {
      const r = await p.request!.preRoute!({ req })
      if (r instanceof Response) return finalize(r, https, security)
    }
  }

  const match = router.find(req.method as "GET", pathname)
  if (!match) {
    return finalize(
      new Response(
        JSON.stringify({
          error: { status: 404, message: `No route for ${req.method} ${pathname}` },
        }),
        { status: 404, headers: { "content-type": "application/json; charset=utf-8" } },
      ),
      https,
      security,
    )
  }

  // Per-request ctx — skips the spread when there are no derivers.
  const ctx = (await applyDerive(booted.blueprint, booted.staticCtx, booted.env, req)) as AppContext

  try {
    if (hooks.before.length > 0) {
      for (const p of hooks.before) {
        await p.request!.before!({ req, ctx, route: match.route })
      }
    }
    const timeoutMs =
      (match.route.meta.timeoutMs as number | undefined) ?? security.requestTimeoutMs
    const res =
      timeoutMs > 0
        ? await withTimeout(runPipeline(match.route, match.params, req, ctx), timeoutMs)
        : await runPipeline(match.route, match.params, req, ctx)
    if (hooks.after.length > 0) {
      for (const p of hooks.after) {
        await p.request!.after!({ req, ctx, res, route: match.route })
      }
    }
    return finalize(res, https, security, match.route.meta.headers)
  } catch (e) {
    if (hooks.onError.length > 0) {
      for (const p of hooks.onError) {
        await p.request!.onError!({ req, ctx, error: e, route: match.route })
      }
    }
    const err = e instanceof SchemaValidationError ? schemaToHyperError(e) : asHyperError(e)
    return finalize(errorResponse(err), https, security)
  }
}

function schemaToHyperError(e: SchemaValidationError): HyperError {
  return new HyperError({
    status: 400,
    code: "validation_failed",
    message: "Request failed validation.",
    why: "One or more inputs did not match the declared schema.",
    fix: "Check the `details` field for per-field issues and correct the payload.",
    details: {
      issues: e.issues.map((i) => ({
        path: i.path?.map(String) ?? [],
        message: i.message,
      })),
    },
  })
}

/**
 * Shared prototype for the per-request handler ctx. Every field that
 * isn't strictly needed up-front is declared as a lazy getter —
 * `ctx.url`, `ctx.query`, `ctx.headers`, `ctx.responseHeaders`. When
 * the route declares a schema we set the parsed value as an own
 * property on the instance, which shadows the getter. The handler
 * pays the cost of allocating a URL / URLSearchParams / Headers only
 * when it actually touches them.
 *
 * Using a shared prototype (not a per-request defineProperty) means
 * every ictx shares one hidden class — JSC specializes it cleanly.
 */
interface LazyCtxState {
  req: Request
  _url?: URL
  _query?: unknown
  _headers?: unknown
  _rh?: Headers
  _cookies?: import("bun").CookieMap
}

/**
 * Each lazy accessor has both a getter (materialize-on-first-read)
 * and a setter (cache override). The setter lets the pipeline write
 * parsed schema output through `ictx.query = parsed` without
 * tripping strict-mode's "assign to readonly property" error, while
 * also giving us the hidden-class benefit of a single shared layout.
 */
const ICTX_PROTO: PropertyDescriptorMap = {
  url: {
    get(this: LazyCtxState): URL {
      let u = this._url
      if (u === undefined) {
        u = new URL(this.req.url)
        this._url = u
      }
      return u
    },
    set(this: LazyCtxState, v: URL) {
      this._url = v
    },
    enumerable: true,
    configurable: true,
  },
  query: {
    get(this: LazyCtxState): unknown {
      let q = this._query
      if (q === undefined) {
        const out: Record<string, string> = {}
        const url = this.req.url
        const qi = url.indexOf("?")
        if (qi >= 0) {
          const hash = url.indexOf("#", qi)
          const end = hash < 0 ? url.length : hash
          const sp = new URLSearchParams(url.slice(qi + 1, end))
          sp.forEach((v, k) => {
            out[k] = v
          })
        }
        q = out
        this._query = q
      }
      return q
    },
    set(this: LazyCtxState, v: unknown) {
      this._query = v
    },
    enumerable: true,
    configurable: true,
  },
  headers: {
    get(this: LazyCtxState): unknown {
      let h = this._headers
      if (h === undefined) {
        const out: Record<string, string> = {}
        ;(this.req as Request).headers.forEach((v, k) => {
          out[k] = v
        })
        h = out
        this._headers = h
      }
      return h
    },
    set(this: LazyCtxState, v: unknown) {
      this._headers = v
    },
    enumerable: true,
    configurable: true,
  },
  responseHeaders: {
    get(this: LazyCtxState): Headers {
      let rh = this._rh
      if (rh === undefined) {
        rh = new Headers()
        this._rh = rh
      }
      return rh
    },
    set(this: LazyCtxState, v: Headers) {
      this._rh = v
    },
    enumerable: true,
    configurable: true,
  },
  cookies: {
    value(this: LazyCtxState): import("bun").CookieMap {
      let c = this._cookies
      if (c === undefined) {
        c = new Bun.CookieMap(this.req.headers.get("cookie") ?? "")
        this._cookies = c
      }
      return c
    },
    enumerable: true,
    writable: false,
    configurable: false,
  },
}

// All `ictx` objects share this prototype → one hidden class.
const ICTX_PROTOTYPE: object = Object.create(null, ICTX_PROTO)

async function runPipeline(
  route: Route,
  params: Record<string, string>,
  req: Request,
  ctx: AppContext,
): Promise<Response> {
  const parsedParams = route.params ? await parseStandard(route.params, params) : params

  // The ictx object is laid out with a fixed shape so V8/JSC can
  // specialize it. Own-property writes for schema-declared inputs
  // shadow the lazy getters on the prototype.
  const ictx = Object.create(ICTX_PROTOTYPE) as InternalHandlerCtx & LazyCtxState
  ictx.req = req
  ;(ictx as unknown as { params: unknown }).params = parsedParams
  ;(ictx as unknown as { body: unknown }).body = undefined
  ;(ictx as unknown as { ctx: AppContext }).ctx = ctx

  if (route.query) {
    // Schema-declared query → allocate URLSearchParams once, extract
    // into a plain object, then run Standard Schema over it.
    const rawUrl = req.url
    const qi = rawUrl.indexOf("?")
    const queryInput: Record<string, string> = {}
    if (qi >= 0) {
      const hash = rawUrl.indexOf("#", qi)
      const end = hash < 0 ? rawUrl.length : hash
      const sp = new URLSearchParams(rawUrl.slice(qi + 1, end))
      sp.forEach((v, k) => {
        queryInput[k] = v
      })
    }
    const parsed = await parseStandard(route.query, queryInput)
    // Writes through the prototype's setter → caches as own state,
    // shadowing the lazy getter on subsequent reads.
    ;(ictx as unknown as { query: unknown }).query = parsed
  }

  if (hasBody(req.method)) {
    const raw = await parseBodyAuto(req)
    const parsedBody = route.body ? await parseStandard(route.body, raw) : raw
    ;(ictx as unknown as { body: unknown }).body = parsedBody
  }

  if (route.headers) {
    const headerInput: Record<string, string> = {}
    req.headers.forEach((v, k) => {
      headerInput[k] = v
    })
    const parsed = await parseStandard(route.headers, headerInput)
    ;(ictx as unknown as { headers: unknown }).headers = parsed
  }

  const result = await route.handler(ictx)
  return coerce(result)
}

function hasBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
}

function finalize(
  res: Response,
  https: boolean,
  security: SecurityDefaults,
  routeOverrides?: Record<string, string>,
): Response {
  if (!security.headers) return res
  const emitHsts =
    security.hstsEnv === false
      ? false
      : (process.env.NODE_ENV ?? "development") === security.hstsEnv

  // Fast path: response helpers pre-bake the secure defaults, so when
  // there are no route overrides AND we don't need HSTS, we can return
  // the response unchanged. Probe via `x-content-type-options` — this
  // is the sentinel that every Hyper helper emits.
  const needsHsts = https && emitHsts !== false
  if (
    !routeOverrides &&
    !needsHsts &&
    !res.headers.has("server") &&
    res.headers.has("x-content-type-options")
  ) {
    return res
  }

  return applyDefaultHeaders(res, {
    https,
    emitHsts,
    ...(routeOverrides ? { overrides: routeOverrides } : {}),
  })
}

function methodOverrideRejected(which: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        status: 400,
        code: "method_override_rejected",
        message: `Hyper refuses to honor method override via '${which}'.`,
        why: "Method overrides are a CSRF/verb-smuggling vector and are disabled by default.",
        fix: "Call the endpoint with the real HTTP verb. If you really need overrides, set `app({ security: { rejectMethodOverride: false } })`.",
      },
    }),
    { status: 400, headers: { "content-type": "application/json; charset=utf-8" } },
  )
}

/**
 * Cheap https detection from `req.url` — avoids allocating a full URL
 * on the boot-error path. `req.url` is always absolute for Bun Request
 * objects produced by `Bun.serve`.
 */
function isHttps(req: Request): boolean {
  const u = req.url
  return u.length > 5 && u.charCodeAt(4) === 115 /* 's' */ && u.startsWith("https:")
}

/**
 * Extract pathname from a fully-qualified request URL without
 * constructing a `URL` object. Returns `/` for inputs without a path.
 * The single allocation is the final `slice()`.
 *
 *   extractPathname("http://host:3000/foo/bar?x=1") === "/foo/bar"
 */
function extractPathname(url: string): string {
  const schemeEnd = url.indexOf("://")
  if (schemeEnd < 0) return "/"
  const pathStart = url.indexOf("/", schemeEnd + 3)
  if (pathStart < 0) return "/"
  const q = url.indexOf("?", pathStart)
  const h = url.indexOf("#", pathStart)
  const end = q < 0 ? h : h < 0 ? q : Math.min(q, h)
  return end < 0 ? url.slice(pathStart) : url.slice(pathStart, end)
}

/**
 * Direct string scan for a query parameter key. Avoids URL /
 * URLSearchParams construction on the method-override guard's hot path.
 */
function urlHasQueryKey(url: string, key: string): boolean {
  const qStart = url.indexOf("?")
  if (qStart < 0) return false
  const hash = url.indexOf("#", qStart)
  const qEnd = hash < 0 ? url.length : hash
  const keyLen = key.length
  let i = qStart + 1
  while (i < qEnd) {
    const delim = url.indexOf("&", i)
    const segEnd = delim < 0 || delim >= qEnd ? qEnd : delim
    // A key is a match when either "key=" starts at i, or the raw key
    // appears as a flag (no `=`) and runs to segEnd.
    if (
      i + keyLen <= segEnd &&
      url.startsWith(key, i) &&
      (i + keyLen === segEnd || url.charCodeAt(i + keyLen) === 61) /* '=' */
    ) {
      return true
    }
    if (delim < 0) return false
    i = delim + 1
  }
  return false
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new HyperError({
          status: 504,
          code: "request_timeout",
          message: `Handler exceeded ${ms}ms timeout.`,
          why: "The handler did not produce a response in time.",
          fix: "Make the handler faster, raise `security.requestTimeoutMs`, or set `.meta({ timeoutMs })` per-route.",
        }),
      )
    }, ms)
    if (typeof (timer as { unref?: () => void }).unref === "function") {
      ;(timer as { unref: () => void }).unref()
    }
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function buildBunRoutes(
  routes: readonly Route[],
  fetch: (req: Request) => Promise<Response>,
): BunRoutes {
  const map: BunRoutes = {}
  // Index routes by path so we can detect fully-static paths (every
  // method on that path is a `.staticResponse()`). Static paths let
  // Bun.serve's native router short-circuit without calling a fn.
  const byPath = new Map<string, Route[]>()
  for (const r of routes) {
    const list = byPath.get(r.path)
    if (list) list.push(r)
    else byPath.set(r.path, [r])
  }
  for (const [path, list] of byPath) {
    const allStatic = list.length > 0 && list.every((r) => r.kind === "static")
    if (allStatic && list.length === 1 && list[0]!.staticResponse) {
      // Single-method static response → native static route (Response)
      map[path] = list[0]!.staticResponse
    } else if (allStatic) {
      // Method-keyed static responses.
      const methodMap: Record<string, Response> = {}
      for (const r of list) {
        if (r.staticResponse) methodMap[r.method] = r.staticResponse
      }
      map[path] = methodMap
    } else {
      map[path] = (req: Request) => fetch(req)
    }
  }
  return map
}
