/**
 * route.resource() — emit a standard CRUD bundle for a collection.
 *
 * Example:
 *   const users = resource("/users", {
 *     list:   () => store.list(),
 *     get:    ({ params }) => store.get(params.id),
 *     create: ({ body }) => store.create(body),
 *     update: ({ params, body }) => store.update(params.id, body),
 *     remove: ({ params }) => store.remove(params.id),
 *   })
 *
 * Returns an array of routes ready to add to `app({ routes })`.
 */

import { type CallableRoute, route } from "./route.ts"
import type { HandlerReturn, HttpMethod } from "./types.ts"

type HandlerFn<P, B> = (args: {
  params: P
  body: B
  req: Request
  url: URL
  // biome-ignore lint/suspicious/noExplicitAny: ctx is user-augmented
  ctx: any
}) => Promise<HandlerReturn> | HandlerReturn

export interface ResourceHandlers<T, U = Partial<T>> {
  readonly list?: HandlerFn<Record<string, string>, never>
  readonly get?: HandlerFn<{ id: string }, never>
  readonly create?: HandlerFn<Record<string, string>, T>
  readonly update?: HandlerFn<{ id: string }, U>
  readonly remove?: HandlerFn<{ id: string }, never>
}

export interface ResourceOptions {
  /** Human-readable resource name (for metadata). */
  readonly name?: string
  /** Expose CRUD as MCP tools. */
  readonly mcp?: boolean
}

export function resource<T, U = Partial<T>>(
  basePath: string,
  handlers: ResourceHandlers<T, U>,
  opts: ResourceOptions = {},
): readonly CallableRoute[] {
  const name = opts.name ?? basePath.replace(/\//g, "")
  const mcpMeta = (op: string, desc: string): { mcp: { description: string } } | object =>
    opts.mcp ? { mcp: { description: `${desc} (${name})` } } : {}
  const out: CallableRoute[] = []

  if (handlers.list) {
    out.push(
      route
        .get(basePath)
        .meta({ name: `${name}.list`, tags: [name], ...mcpMeta("list", "List") })
        .handle((c) =>
          handlers.list!({
            params: c.params as Record<string, string>,
            body: undefined as never,
            req: c.req,
            url: c.url,
            ctx: c.ctx,
          }),
        ) as CallableRoute,
    )
  }
  if (handlers.get) {
    out.push(
      route
        .get(`${basePath}/:id`)
        .meta({ name: `${name}.get`, tags: [name], ...mcpMeta("get", "Get") })
        .handle((c) =>
          handlers.get!({
            params: c.params as { id: string },
            body: undefined as never,
            req: c.req,
            url: c.url,
            ctx: c.ctx,
          }),
        ) as CallableRoute,
    )
  }
  if (handlers.create) {
    out.push(
      route
        .post(basePath)
        .meta({ name: `${name}.create`, tags: [name], ...mcpMeta("create", "Create") })
        .handle((c) =>
          handlers.create!({
            params: c.params as Record<string, string>,
            body: c.body as T,
            req: c.req,
            url: c.url,
            ctx: c.ctx,
          }),
        ) as CallableRoute,
    )
  }
  if (handlers.update) {
    out.push(
      route
        .patch(`${basePath}/:id`)
        .meta({ name: `${name}.update`, tags: [name], ...mcpMeta("update", "Update") })
        .handle((c) =>
          handlers.update!({
            params: c.params as { id: string },
            body: c.body as U,
            req: c.req,
            url: c.url,
            ctx: c.ctx,
          }),
        ) as CallableRoute,
    )
  }
  if (handlers.remove) {
    out.push(
      route
        .delete(`${basePath}/:id`)
        .meta({ name: `${name}.remove`, tags: [name], ...mcpMeta("remove", "Remove") })
        .handle((c) =>
          handlers.remove!({
            params: c.params as { id: string },
            body: undefined as never,
            req: c.req,
            url: c.url,
            ctx: c.ctx,
          }),
        ) as CallableRoute,
    )
  }

  return out
}

/** Convenience mapping to avoid explicit HttpMethod unions in docs. */
export type ResourceMethod = Extract<HttpMethod, "GET" | "POST" | "PATCH" | "DELETE">
