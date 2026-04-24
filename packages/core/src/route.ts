/**
 * Route builder — the fluent, immutable DX surface.
 *
 * Every chain step returns a new builder with an updated type state.
 * `.handle(fn)` closes the builder and produces a `Route` value.
 *
 * Surface:
 *   route.<verb>(path)
 *     .params(schema)
 *     .query(schema)
 *     .body(schema)
 *     .headers(schema)
 *     .meta({...})
 *     .use(middleware)             // output access + mapInput
 *     .errors({ CODE: schema })    // named-code catalog
 *     .throws({ 404: schema })     // declared thrown shapes
 *     .handle(fn)                  // closes the builder into a Route
 *
 * Returned Route carries an attached `.callable(ctx, input)` for in-
 * process invocation (testing, Server Actions, projections).
 */

import type { ChainRunner, Middleware } from "./middleware.ts"
import { compileChain } from "./middleware.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"
import type {
  HandlerReturn,
  HttpMethod,
  InternalHandlerCtx,
  Route,
  RouteHandler,
  RouteMeta,
} from "./types.ts"

export interface BuilderState {
  params?: StandardSchemaV1
  query?: StandardSchemaV1
  body?: StandardSchemaV1
  headers?: StandardSchemaV1
  meta: RouteMeta
  middleware: readonly Middleware[]
  errors?: Record<string, StandardSchemaV1>
  throws?: Record<number, StandardSchemaV1>
}

export type InferIn<S> = S extends StandardSchemaV1<infer _I, infer O> ? O : unknown

export interface HandlerCtx<Params = unknown, Query = unknown, Body = unknown, HeadersT = unknown> {
  readonly req: Request
  readonly url: URL
  readonly params: Params
  readonly query: Query
  readonly body: Body
  readonly headers: HeadersT
  readonly cookies: () => import("bun").CookieMap
  /** Decorated app context — `ctx.log`, `ctx.db`, etc. */
  readonly ctx: import("./types.ts").AppContext
}

/** A Route that can also be invoked as a plain async function. */
export interface CallableRoute<
  M extends HttpMethod = HttpMethod,
  Params = unknown,
  Query = unknown,
  Body = unknown,
  HeadersT = unknown,
  Output = unknown,
> extends Route<M> {
  readonly callable: (input: {
    params?: Params
    query?: Query
    body?: Body
    headers?: HeadersT
    req?: Request
    ctx?: import("./types.ts").AppContext
  }) => Promise<Output>
}

export class RouteBuilder<
  M extends HttpMethod = HttpMethod,
  Params = unknown,
  Query = unknown,
  Body = unknown,
  HeadersT = unknown,
> {
  readonly #method: M
  readonly #path: string
  readonly #state: BuilderState

  constructor(method: M, path: string, state: BuilderState = { meta: {}, middleware: [] }) {
    this.#method = method
    this.#path = path
    this.#state = state
  }

  params<S extends StandardSchemaV1>(
    schema: S,
  ): RouteBuilder<M, InferIn<S>, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, { ...this.#state, params: schema })
  }

  query<S extends StandardSchemaV1>(
    schema: S,
  ): RouteBuilder<M, Params, InferIn<S>, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, { ...this.#state, query: schema })
  }

  body<S extends StandardSchemaV1>(
    schema: S,
  ): RouteBuilder<M, Params, Query, InferIn<S>, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, { ...this.#state, body: schema })
  }

  headers<S extends StandardSchemaV1>(schema: S): RouteBuilder<M, Params, Query, Body, InferIn<S>> {
    return new RouteBuilder(this.#method, this.#path, { ...this.#state, headers: schema })
  }

  meta(meta: RouteMeta): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: { ...this.#state.meta, ...meta },
    })
  }

  /** Mark deprecated — emits Sunset header + OpenAPI + client JSDoc. */
  deprecated(
    opts: boolean | { reason?: string; sunset?: Date | string } = true,
  ): RouteBuilder<M, Params, Query, Body, HeadersT> {
    let value: RouteMeta["deprecated"]
    if (typeof opts === "boolean") {
      value = opts
    } else {
      const out: { reason?: string; sunset?: string } = {}
      if (opts.reason !== undefined) out.reason = opts.reason
      if (opts.sunset !== undefined) {
        out.sunset = opts.sunset instanceof Date ? opts.sunset.toUTCString() : opts.sunset
      }
      value = out
    }
    const nextHeaders: Record<string, string> = { ...(this.#state.meta.headers ?? {}) }
    if (typeof value === "object" && value?.sunset) {
      nextHeaders.Sunset = value.sunset
    } else if (value === true) {
      nextHeaders.Deprecation = "true"
    }
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: { ...this.#state.meta, deprecated: value, headers: nextHeaders },
    })
  }

  /** Tag this route with a version string (header or URL prefix routed). */
  version(v: string): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: { ...this.#state.meta, version: v },
    })
  }

  /** Add an example — surfaced in OpenAPI, MCP few-shot, client JSDoc, tests. */
  example(ex: import("./types.ts").RouteExample): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: {
        ...this.#state.meta,
        examples: [...(this.#state.meta.examples ?? []), ex],
      },
    })
  }

  /** Per-route timeout in milliseconds (overrides `security.requestTimeoutMs`). */
  timeout(ms: number): RouteBuilder<M, Params, Query, Body, HeadersT> {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`route.timeout(${ms}): must be a non-negative finite number of milliseconds`)
    }
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: { ...this.#state.meta, timeoutMs: ms },
    })
  }

  /**
   * Short-circuit to a constant Response. Eligible for Bun.serve's static
   * routes path — no handler invocation, no middleware, near-zero latency.
   *
   *   route.get("/health").static(Response.json({ ok: true }))
   *
   * Use cases: health checks, robots.txt, static configuration, feature
   * flags served from a CDN origin, etc. If you need middleware (logging,
   * auth), fall back to `.handle(() => ...)`.
   */
  staticResponse(res: Response): Route<M> {
    const method = this.#method
    const path = this.#path
    const state = this.#state
    // The hot path is Bun.serve's native static routes, which consume
    // `staticResponse` directly and never invoke `handler`. The dev
    // router falls back to `res.clone()` — Bun's clone is O(body) for
    // string bodies and doesn't materialize a buffer.
    return {
      method,
      path,
      meta: state.meta,
      handler: () => res.clone(),
      kind: "static",
      staticResponse: res,
    }
  }

  /** Mark the route as a React Server Action. */
  actionable(): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      meta: { ...this.#state.meta, action: true },
    })
  }

  use(mw: Middleware): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      middleware: [...this.#state.middleware, mw],
    })
  }

  /** Declare thrown error shapes per HTTP status (declared-throws contract). */
  throws(map: Record<number, StandardSchemaV1>): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      throws: { ...(this.#state.throws ?? {}), ...map },
    })
  }

  /** Declare named-code error catalog. */
  errors(map: Record<string, StandardSchemaV1>): RouteBuilder<M, Params, Query, Body, HeadersT> {
    return new RouteBuilder(this.#method, this.#path, {
      ...this.#state,
      errors: { ...(this.#state.errors ?? {}), ...map },
    })
  }

  handle(
    fn: (ctx: HandlerCtx<Params, Query, Body, HeadersT>) => Promise<HandlerReturn> | HandlerReturn,
  ): CallableRoute<M, Params, Query, Body, HeadersT, HandlerReturn> {
    const state = this.#state
    const method = this.#method
    const path = this.#path

    // Precompile the middleware chain at build time — zero-middleware
    // routes get a direct-call fast path with no extra allocations.
    const chain: ChainRunner = compileChain(state.middleware)
    const hasMiddleware = state.middleware.length > 0

    const handler: RouteHandler = (ictx: InternalHandlerCtx) => {
      // ictx is shaped by the pipeline to exactly match HandlerCtx —
      // url / query / headers are either the parsed schema output
      // (set as own properties by runPipeline) or lazy prototype
      // getters that materialize on first access. We skip the typed-
      // copy allocation that the old implementation paid per request.
      const typed = ictx as unknown as HandlerCtx<Params, Query, Body, HeadersT>
      if (!hasMiddleware) return fn(typed)
      return chain(
        {
          ctx: ictx.ctx,
          input: {
            params: typed.params,
            query: typed.query,
            body: typed.body,
            headers: typed.headers,
          },
          req: ictx.req,
          path,
          params: ictx.params,
        },
        () => fn(typed),
      )
    }

    const middlewareTags: string[] = []
    for (const mw of state.middleware) {
      const tag = (mw as unknown as { __hyperTag?: string }).__hyperTag
      if (typeof tag === "string") middlewareTags.push(tag)
    }

    const r: CallableRoute<M, Params, Query, Body, HeadersT, HandlerReturn> = {
      method,
      path,
      ...(state.params !== undefined && { params: state.params }),
      ...(state.query !== undefined && { query: state.query }),
      ...(state.body !== undefined && { body: state.body }),
      ...(state.headers !== undefined && { headers: state.headers }),
      meta: state.meta,
      handler,
      ...(state.throws !== undefined && { throws: state.throws }),
      ...(state.errors !== undefined && { errors: state.errors }),
      ...(middlewareTags.length > 0 && { middlewareTags }),
      kind: "fn",
      callable: async (input) => {
        const req = input.req ?? new Request(`http://local${path}`, { method })
        return fn({
          req,
          url: new URL(req.url),
          params: (input.params ?? {}) as Params,
          query: (input.query ?? {}) as Query,
          body: (input.body ?? undefined) as Body,
          headers: (input.headers ?? {}) as HeadersT,
          cookies: () => new Bun.CookieMap(req.headers.get("cookie") ?? ""),
          ctx: (input.ctx ?? {}) as import("./types.ts").AppContext,
        })
      },
    }
    return r
  }
}

export const route: {
  get: (path: string) => RouteBuilder<"GET">
  post: (path: string) => RouteBuilder<"POST">
  put: (path: string) => RouteBuilder<"PUT">
  patch: (path: string) => RouteBuilder<"PATCH">
  delete: (path: string) => RouteBuilder<"DELETE">
  head: (path: string) => RouteBuilder<"HEAD">
  options: (path: string) => RouteBuilder<"OPTIONS">
  lazy: <R extends Route>(loader: () => Promise<{ default: R } | R>) => Promise<R>
} = {
  get: (path) => new RouteBuilder("GET", path),
  post: (path) => new RouteBuilder("POST", path),
  put: (path) => new RouteBuilder("PUT", path),
  patch: (path) => new RouteBuilder("PATCH", path),
  delete: (path) => new RouteBuilder("DELETE", path),
  head: (path) => new RouteBuilder("HEAD", path),
  options: (path) => new RouteBuilder("OPTIONS", path),
  lazy: async <R extends Route>(loader: () => Promise<{ default: R } | R>): Promise<R> => {
    const mod = await loader()
    if (mod && typeof mod === "object" && "default" in mod) {
      return (mod as { default: R }).default
    }
    return mod as R
  },
}
