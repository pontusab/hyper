/**
 * Middleware — with input, output access, and mapInput.
 *
 * Signature:
 *   ({ ctx, input, next, mapInput }) => Promise<Response>
 *
 * `next(transformedInput?)` runs the rest of the chain (or the handler)
 * and returns the output. Middleware can inspect / transform / short-
 * circuit the response.
 *
 * Lifecycle factories (`onStart`, `onSuccess`, `onError`, `onFinish`)
 * are sugar over this primitive. They always produce a regular
 * middleware under the hood — meta is sugar.
 */

import type { AppContext, HandlerReturn } from "./types.ts"

export interface MiddlewareArgs<C = AppContext, I = unknown> {
  readonly ctx: C
  /** Input resolved from `params`/`query`/`body`/`headers`. */
  readonly input: I
  /** The actual Request. */
  readonly req: Request
  /** Current route path (inc. matched params). */
  readonly path: string
  /** Invoke the rest of the chain + handler; optionally mapInput. */
  readonly next: (mapped?: I) => Promise<HandlerReturn> | HandlerReturn
  /** Matched params for mapping convenience. */
  readonly params: Record<string, string>
}

export type Middleware<C = AppContext, I = unknown> = (
  args: MiddlewareArgs<C, I>,
) => Promise<HandlerReturn> | HandlerReturn

// Lifecycle factories --------------------------------------------------------

export function onStart<C = AppContext>(
  fn: (
    args: Pick<MiddlewareArgs<C, unknown>, "ctx" | "input" | "req" | "path" | "params">,
  ) => void | Promise<void>,
): Middleware<C, unknown> {
  return async ({ ctx, input, next, req, path, params }) => {
    await fn({ ctx, input, req, path, params })
    return next()
  }
}

export function onSuccess<C = AppContext>(
  fn: (args: {
    ctx: C
    output: HandlerReturn
    req: Request
  }) => void | Promise<void>,
): Middleware<C, unknown> {
  return async ({ ctx, next, req }) => {
    const output = await next()
    await fn({ ctx, output, req })
    return output
  }
}

export function onError<C = AppContext>(
  fn: (args: { ctx: C; error: unknown; req: Request }) => void | Promise<void>,
): Middleware<C, unknown> {
  return async ({ ctx, next, req }) => {
    try {
      return await next()
    } catch (error) {
      await fn({ ctx, error, req })
      throw error
    }
  }
}

export function onFinish<C = AppContext>(
  fn: (args: {
    ctx: C
    output?: HandlerReturn
    error?: unknown
    req: Request
  }) => void | Promise<void>,
): Middleware<C, unknown> {
  return async ({ ctx, next, req }) => {
    try {
      const output = await next()
      await fn({ ctx, output, req })
      return output
    } catch (error) {
      await fn({ ctx, error, req })
      throw error
    }
  }
}

/**
 * Runner produced by `compileChain` — invokes the precompiled pipeline.
 *
 * `next` is captured per-request so each middleware's `next()` call is a
 * single function reference, not a closure rebuilt on every dispatch.
 */
export type ChainRunner = (
  args: Omit<MiddlewareArgs, "next">,
  base: () => Promise<HandlerReturn> | HandlerReturn,
) => Promise<HandlerReturn> | HandlerReturn

/**
 * Precompile a middleware chain into a single function, once, at
 * route-build time. Eliminates per-request closure allocations that a
 * naive composition would pay. Zero-middleware routes get the fast
 * path — the compiled runner delegates directly to `base`.
 */
export function compileChain(middleware: readonly Middleware[]): ChainRunner {
  if (middleware.length === 0) {
    return (_args, base) => base()
  }
  return (args, base) => {
    let i = 0
    const dispatch = (mapped?: unknown): Promise<HandlerReturn> | HandlerReturn => {
      if (i >= middleware.length) return base()
      const mw = middleware[i++]!
      const mwArgs: MiddlewareArgs = {
        ctx: args.ctx,
        input: mapped !== undefined ? mapped : args.input,
        req: args.req,
        path: args.path,
        params: args.params,
        next: dispatch,
      }
      return mw(mwArgs)
    }
    return dispatch()
  }
}
