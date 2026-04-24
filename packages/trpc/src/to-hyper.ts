/**
 * trpcToHyper — walks a tRPC router's procedure map and emits Hyper routes.
 * Used for migration: drop a tRPC router into a Hyper app with one call.
 *
 * We emit one POST route per procedure at `${prefix}/${procPath}`, body =
 * the raw tRPC input. Query-vs-mutation distinction is preserved via
 * `meta.trpc.type`.
 */

import { type CallableRoute, route } from "@usehyper/core"
import type { TrpcRouterLike, TrpcToHyperOptions } from "./types.ts"

export function trpcToHyper(
  router: TrpcRouterLike,
  opts: TrpcToHyperOptions = {},
): readonly CallableRoute[] {
  const prefix = (opts.prefix ?? "/trpc").replace(/\/+$/, "")
  const procedures =
    (
      router as {
        _def?: { procedures?: Record<string, { _def?: { type?: string } }> }
      }
    )._def?.procedures ?? {}

  const routes: CallableRoute[] = []
  for (const [procName, proc] of Object.entries(procedures)) {
    const type = proc._def?.type ?? "mutation"
    const meta = {
      name: procName,
      trpc: { type },
      ...(opts.mapMeta ? opts.mapMeta(procName, proc) : {}),
    }
    const r = route
      .post(`${prefix}/${procName}`)
      .meta(meta)
      .handle(async (c) => {
        const callable = proc as unknown as (args: {
          ctx: unknown
          input: unknown
          rawInput: unknown
          type: string
        }) => Promise<unknown>
        const input = (c.body as { input?: unknown })?.input
        const data = await callable({ ctx: c.ctx, input, rawInput: input, type })
        return { result: { data } }
      }) as CallableRoute
    routes.push(r)
  }
  return routes
}
