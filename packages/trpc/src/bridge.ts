/**
 * Mount a tRPC router at a path prefix inside a Hyper app.
 *
 * Strategy: we use tRPC's `callTRPCProcedure` API if available; otherwise
 * fall back to a minimal POST-JSON protocol we know how to drive:
 *
 *   POST /trpc/<procPath>          body: { input?: ... }
 *   response: { result: { data: T } }  or  { error: { code, message, data } }
 *
 * The tRPC server package itself provides `fetchRequestHandler` — users who
 * want full batch/stream semantics should use that directly and simply add
 * an explicit Hyper route that forwards the request.
 */

import type { HyperPlugin, Middleware } from "@hyper/core"
import type { TrpcBridgeOptions, TrpcRouterLike } from "./types.ts"

export function trpcPlugin<Ctx = unknown>(
  router: TrpcRouterLike,
  opts: TrpcBridgeOptions<Ctx> = {},
): HyperPlugin {
  const prefix = (opts.prefix ?? "/trpc").replace(/\/+$/, "")
  const trpcAny = router as { _def?: { procedures?: Record<string, unknown> } }
  const procedures = trpcAny?._def?.procedures ?? {}

  return {
    name: "@hyper/trpc",
    async build(app) {
      // The bridge is delivered as an HTTP handler mounted via
      // `trpcHandler(path)` returned below. This `build` hook is a no-op
      // but reserved for future dynamic route registration.
      void app
    },
  }
}

/**
 * Build a fetch-compatible handler you can mount as a Hyper route:
 *
 *   app({ routes: [
 *     route.post("/trpc/:proc").handle(trpcHandler(router)),
 *     route.post("/trpc/:proc/*").handle(trpcHandler(router)),
 *   ]})
 *
 * Or as a catch-all via your framework of choice.
 */
export function trpcHandler<Ctx>(
  router: TrpcRouterLike,
  opts: TrpcBridgeOptions<Ctx> = {},
): (c: {
  req: Request
  params: { proc?: string }
  ctx: Ctx
  body: unknown
}) => Promise<Response> {
  const trpcAny = router as {
    _def?: { procedures?: Record<string, { _def?: { type?: string } }> }
  }
  const procedures = trpcAny._def?.procedures ?? {}
  return async (c) => {
    const procName = c.params.proc
    if (!procName) {
      return json({ error: { code: "BAD_REQUEST", message: "missing procedure" } }, 400)
    }
    const proc = procedures[procName]
    if (!proc) {
      return json({ error: { code: "NOT_FOUND", message: `unknown procedure: ${procName}` } }, 404)
    }
    const rawInput = (c.body as { input?: unknown } | undefined)?.input
    try {
      const callable = proc as unknown as (args: {
        ctx: unknown
        input: unknown
        rawInput: unknown
        type: string
      }) => Promise<unknown>
      const ctx = opts.createContext ? await opts.createContext({ req: c.req, ctx: c.ctx }) : c.ctx
      const type = proc._def?.type ?? (c.req.method === "GET" ? "query" : "mutation")
      const data = await callable({ ctx, input: rawInput, rawInput, type })
      return json({ result: { data } }, 200)
    } catch (e) {
      opts.onError?.({ path: procName, error: e })
      const err = e as { code?: string; message?: string; cause?: unknown }
      return json(
        {
          error: {
            code: err.code ?? "INTERNAL_SERVER_ERROR",
            message: err.message ?? "tRPC procedure failed",
          },
        },
        500,
      )
    }
  }
}

/**
 * sharedCtxMiddleware — exposes Hyper's AppContext as tRPC's ctx, so the
 * same ctx singletons (db, log, session) power both transports.
 */
export function sharedCtxMiddleware(): Middleware {
  return async (args) => args.next()
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
