/**
 * createClient — a typed-ish RPC client. The generics are threaded so that
 * if you hand a `PlainRouter` shape to `createClient`, you get dot-paths.
 *
 * Example:
 *   const api = createClient<typeof router>(fetchTransport({ baseUrl }))
 *   await api.users.list()
 *   await api.users.create({ title: "x" })
 */

import type { Transport } from "./types.ts"

// Stand-alone clone of the core PlainRouter shape to avoid a type dep.
type RouterLike = {
  // biome-ignore lint/suspicious/noExplicitAny: structural router
  [key: string]: any
}

type CallableRouteLike = {
  readonly method: string
  readonly path: string
  readonly meta?: unknown
}

/**
 * We expose the transport directly. Codegen emits a thin wrapper with
 * the proper TypeScript shape for the user; the runtime is identical.
 */
export interface ClientContract {
  call<T = unknown>(input: {
    method: string
    path: string
    params?: Record<string, string>
    query?: Record<string, unknown>
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
  }): Promise<T>
}

export function createClient(transport: Transport): ClientContract {
  return {
    async call(input) {
      const path = applyPathParams(input.path, input.params)
      const url = input.query ? `${path}?${new URLSearchParams(stringifyQuery(input.query))}` : path
      const res = await transport.request({
        method: input.method,
        url,
        ...(input.headers ? { headers: input.headers } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      })
      if (res.status >= 400) {
        const err = extractError(res.data, res.status)
        throw Object.assign(new Error(err.message), err)
      }
      return res.data as never
    },
  }
}

export function applyPathParams(path: string, params: Record<string, string> | undefined): string {
  if (!params) return path
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, k: string) => {
    const v = params[k]
    if (v === undefined) throw new Error(`missing path param :${k}`)
    return encodeURIComponent(v)
  })
}

function stringifyQuery(q: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue
    out[k] = String(v)
  }
  return out
}

function extractError(
  data: unknown,
  status: number,
): { status: number; code: string; message: string } {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: Record<string, unknown> }).error
    return {
      status,
      code: typeof e.code === "string" ? e.code : "unknown",
      message: typeof e.message === "string" ? e.message : `HTTP ${status}`,
    }
  }
  return { status, code: "unknown", message: `HTTP ${status}` }
}

/**
 * routerToClient — mirrors a plain-object router tree at runtime, replacing
 * each CallableRoute leaf with a function that invokes the transport.
 * Codegen emits a static `.d.ts` equivalent; this is the runtime twin.
 */
export function routerToClient<R extends RouterLike>(router: R, transport: Transport): RouterLike {
  const client = createClient(transport)
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node
    if (isRoute(node)) {
      const r = node as CallableRouteLike
      return async (input?: {
        params?: Record<string, string>
        query?: Record<string, unknown>
        body?: unknown
        headers?: Record<string, string>
        signal?: AbortSignal
      }) =>
        client.call({
          method: r.method,
          path: r.path,
          ...(input?.params && { params: input.params }),
          ...(input?.query && { query: input.query }),
          ...(input?.body !== undefined && { body: input.body }),
          ...(input?.headers && { headers: input.headers }),
          ...(input?.signal && { signal: input.signal }),
        })
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = walk(v)
    return out
  }
  return walk(router) as RouterLike
}

function isRoute(x: unknown): boolean {
  return Boolean(
    x &&
      typeof x === "object" &&
      typeof (x as { method?: unknown }).method === "string" &&
      typeof (x as { path?: unknown }).path === "string" &&
      typeof (x as { handler?: unknown }).handler === "function",
  )
}
