/**
 * @hyper/dev-mcp — localhost-only MCP server embedded under /.hyper/mcp.
 *
 *   app({ plugins: [devMcpPlugin({ enabled: process.env.NODE_ENV !== "production" })] })
 *
 * Safety:
 *   - Hard-disabled unless enabled=true (or NODE_ENV !== "production").
 *   - Denies requests not coming from loopback.
 *   - Never projects routes tagged `meta.internal: true`.
 */

import type { HyperApp, HyperPlugin } from "@hyper/core"
import { DevRecorder, type RecordedError, type RecordedRequest } from "./recorder.ts"
import { type DevTool, buildTools } from "./tools.ts"

export { DevRecorder } from "./recorder.ts"
export type { RecordedError, RecordedRequest } from "./recorder.ts"
export { buildTools } from "./tools.ts"
export type { DevTool } from "./tools.ts"

export interface DevMcpConfig {
  readonly enabled?: boolean
  /** URL path the dev MCP server lives at. Default: /.hyper/mcp */
  readonly path?: string
  /** Extra IP prefixes permitted in addition to 127.* and ::1. */
  readonly allowedHosts?: readonly string[]
  readonly recorder?: DevRecorder
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"])

export function devMcpPlugin(config: DevMcpConfig = {}): HyperPlugin {
  const enabled = config.enabled ?? process.env.NODE_ENV !== "production"
  const base = config.path ?? "/.hyper/mcp"
  const recorder = config.recorder ?? new DevRecorder()
  const allowed = new Set([...LOOPBACK, ...(config.allowedHosts ?? [])])
  let tools: readonly DevTool[] = []
  let appRef: HyperApp | undefined

  const requestIds = new WeakMap<Request, string>()
  const startTimes = new WeakMap<Request, number>()

  return {
    name: "@hyper/dev-mcp",
    build(app) {
      if (!enabled) return
      appRef = app
      tools = buildTools(app, recorder)
    },
    request: {
      async preRoute({ req }) {
        if (!enabled) return
        const url = new URL(req.url)
        if (url.pathname !== base) return
        if (!isLocal(req, allowed)) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          })
        }
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "method_not_allowed" }), {
            status: 405,
            headers: { "content-type": "application/json" },
          })
        }
        const body = (await req.json().catch(() => null)) as JsonRpc | null
        if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "bad request" } })
        }
        return handle(body, tools)
      },
      before({ req }) {
        if (!enabled) return
        requestIds.set(req, crypto.randomUUID())
        startTimes.set(req, performance.now())
      },
      async after({ req, res, route }) {
        if (!enabled || !appRef) return
        const url = new URL(req.url)
        if (url.pathname === base) return
        if (route?.meta.internal) return
        recorder.push({
          id: requestIds.get(req) ?? crypto.randomUUID(),
          method: req.method,
          path: url.pathname,
          route: route?.path,
          status: res.status,
          durationMs: performance.now() - (startTimes.get(req) ?? performance.now()),
          startedAt: Date.now(),
          headers: Object.fromEntries(req.headers.entries()),
          query: Object.fromEntries(url.searchParams.entries()),
          ...(req.body
            ? {
                body: await req
                  .clone()
                  .text()
                  .catch(() => ""),
              }
            : {}),
        })
      },
      onError({ req, error, route }) {
        if (!enabled) return
        const url = new URL(req.url)
        recorder.pushError({
          id: requestIds.get(req) ?? crypto.randomUUID(),
          method: req.method,
          path: url.pathname,
          route: route?.path,
          at: Date.now(),
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
        })
      },
    },
  }
}

interface JsonRpc {
  readonly jsonrpc: "2.0"
  readonly id?: string | number | null
  readonly method: string
  readonly params?: unknown
}

async function handle(rpc: JsonRpc, tools: readonly DevTool[]): Promise<Response> {
  switch (rpc.method) {
    case "initialize":
      return json({
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "hyper-dev", version: "0.0.0" },
        },
      })
    case "tools/list":
      return json({
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.input,
          })),
        },
      })
    case "tools/call": {
      const p = rpc.params as { name: string; arguments?: Record<string, unknown> } | undefined
      if (!p?.name) {
        return json({
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          error: { code: -32602, message: "missing tool name" },
        })
      }
      const tool = tools.find((t) => t.name === p.name)
      if (!tool) {
        return json({
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          error: { code: -32601, message: `unknown tool: ${p.name}` },
        })
      }
      try {
        const value = await tool.call(p.arguments ?? {})
        return json({
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          result: {
            content: [{ type: "text", text: JSON.stringify(value) }],
            structuredContent: value,
          },
        })
      } catch (e) {
        return json({
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          error: {
            code: -32000,
            message: e instanceof Error ? e.message : String(e),
          },
        })
      }
    }
    default:
      return json({
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        error: { code: -32601, message: `unknown method: ${rpc.method}` },
      })
  }
}

function json(o: unknown): Response {
  return new Response(JSON.stringify(o), {
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function isLocal(req: Request, allowed: Set<string>): boolean {
  const host = req.headers.get("host")?.split(":")[0] ?? ""
  if (allowed.has(host)) return true
  // When behind a proxy / inside Bun.serve, fall back to x-forwarded-for.
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (xff && allowed.has(xff)) return true
  return !host || host === "local"
}
