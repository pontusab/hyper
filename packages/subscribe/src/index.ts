/**
 * @hyper/subscribe — `route.subscribe()` primitive.
 *
 * A single subscription definition projects to:
 *   - HTTP: Server-Sent Events on GET <path>
 *   - MCP:  resource notifications (via resources/subscribe)
 *   - tRPC: subscription procedure
 *
 * The user writes an async generator producing events; we serialize to
 * each protocol. This v0 ships the HTTP→SSE projection; the MCP + tRPC
 * adapters read the same iterator factory so the shape stays uniform.
 */

import { route, sse } from "@hyper/core"
import type { CallableRoute, RouteMeta } from "@hyper/core"

export interface SubscribeEvent<T = unknown> {
  readonly event?: string
  readonly data: T
  readonly id?: string
}

export type SubscribeHandler<T> = (args: {
  req: Request
  signal: AbortSignal
}) => AsyncIterable<SubscribeEvent<T>>

export interface SubscribeOptions {
  readonly name?: string
  readonly description?: string
  readonly meta?: RouteMeta
}

/**
 * Build a subscription route. Returns a `CallableRoute` so callers can
 * call it in tests or via MCP/tRPC without a server.
 */
export function subscribe<T>(
  path: string,
  handler: SubscribeHandler<T>,
  opts: SubscribeOptions = {},
): CallableRoute {
  const meta: RouteMeta = {
    ...(opts.name && { name: opts.name }),
    ...(opts.description && { description: opts.description }),
    ...(opts.meta ?? {}),
    subscription: true,
  }
  return route
    .get(path)
    .meta(meta)
    .handle(async (c) => {
      const controller = new AbortController()
      const signal = controller.signal
      c.req.signal.addEventListener("abort", () => controller.abort(), { once: true })
      const source = handler({ req: c.req, signal })
      const stringified = (async function* () {
        for await (const ev of source) {
          yield {
            data: typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data),
            ...(ev.event && { event: ev.event }),
            ...(ev.id && { id: ev.id }),
          }
        }
      })()
      return sse(stringified, { signal })
    })
}

/**
 * Collect a finite number of events from a subscription — useful for
 * MCP `resources/read` snapshots and for tests.
 */
export async function collect<T>(
  handler: SubscribeHandler<T>,
  n: number,
  req: Request = new Request("http://local/"),
): Promise<readonly SubscribeEvent<T>[]> {
  const out: SubscribeEvent<T>[] = []
  const ctrl = new AbortController()
  for await (const ev of handler({ req, signal: ctrl.signal })) {
    out.push(ev)
    if (out.length >= n) break
  }
  ctrl.abort()
  return out
}
