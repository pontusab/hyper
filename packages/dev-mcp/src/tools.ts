/**
 * Dev MCP tool implementations.
 *
 * Tools expose localhost-only introspection + replay helpers. Internal
 * routes (meta.internal) are never surfaced here.
 */

import type { HyperApp, Route } from "@usehyper/core"
import type { DevRecorder } from "./recorder.ts"

export interface DevTool {
  readonly name: string
  readonly description: string
  readonly input: Record<string, unknown>
  readonly call: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

export function buildTools(app: HyperApp, rec: DevRecorder): readonly DevTool[] {
  return [
    {
      name: "list_routes",
      description: "List every non-internal route in the running app.",
      input: { type: "object", additionalProperties: false },
      call: () =>
        publicRoutes(app).map((r) => ({
          method: r.method,
          path: r.path,
          name: r.meta.name,
          tags: r.meta.tags ?? [],
          deprecated: !!r.meta.deprecated,
          mcp: !!r.meta.mcp,
        })),
    },
    {
      name: "get_route",
      description: "Fetch detailed metadata (params, query, body, examples) for a route.",
      input: {
        type: "object",
        properties: {
          method: { type: "string" },
          path: { type: "string" },
        },
        required: ["method", "path"],
      },
      call: (args) => {
        const { method, path } = args as { method: string; path: string }
        const r = publicRoutes(app).find(
          (x) => x.method.toUpperCase() === method.toUpperCase() && x.path === path,
        )
        if (!r) return { error: "route_not_found" }
        return {
          method: r.method,
          path: r.path,
          meta: r.meta,
          hasParams: !!r.params,
          hasQuery: !!r.query,
          hasBody: !!r.body,
          hasHeaders: !!r.headers,
          throws: r.throws ? Object.keys(r.throws).map(Number) : [],
          errors: r.errors ? Object.keys(r.errors) : [],
        }
      },
    },
    {
      name: "recent_requests",
      description: "Return the last N handled HTTP requests (default 50).",
      input: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
      },
      call: (args) => rec.requests((args?.limit as number) ?? 50),
    },
    {
      name: "recent_errors",
      description: "Return the last N errors captured while handling requests.",
      input: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
      },
      call: (args) => rec.errors((args?.limit as number) ?? 50),
    },
    {
      name: "invoke_route",
      description:
        "Invoke a route in-process (no network). Same path as HTTP — runs middleware, validators, handler.",
      input: {
        type: "object",
        properties: {
          method: { type: "string" },
          path: { type: "string" },
          params: { type: "object", additionalProperties: true },
          query: { type: "object", additionalProperties: true },
          body: {},
          headers: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["method", "path"],
      },
      call: async (args) => {
        const { method, path, params, query, body, headers } = args as {
          method: string
          path: string
          params?: Record<string, string>
          query?: Record<string, unknown>
          body?: unknown
          headers?: Record<string, string>
        }
        return app.invoke({
          method: method.toUpperCase() as "GET",
          path,
          ...(params && { params }),
          ...(query && { query }),
          ...(body !== undefined && { body }),
          ...(headers && { headers }),
        })
      },
    },
    {
      name: "replay_request",
      description: "Replay a previously recorded request by id (dev-only).",
      input: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      call: async (args) => {
        const { id } = args as { id: string }
        const r = rec.find(id)
        if (!r) return { error: "request_not_found" }
        return app.invoke({
          method: r.method as "GET",
          path: r.path,
          query: Object.fromEntries(Object.entries(r.query)),
          headers: r.headers,
          ...(r.body !== undefined && {
            body: safeParseJson(r.body),
          }),
        })
      },
    },
  ]
}

function publicRoutes(app: HyperApp): readonly Route[] {
  return app.routeList.filter((r) => !r.meta.internal)
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
