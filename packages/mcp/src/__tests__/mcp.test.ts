import { describe, expect, test } from "bun:test"
import { app, created, ok, route } from "@hyper/core"
import { auditMcp, mcpServer } from "../index.ts"

function buildApp() {
  return app({
    routes: [
      route
        .get("/users")
        .meta({ name: "users.list", mcp: { description: "List users" } })
        .handle(() => ok([{ id: "u1" }])),
      route
        .post("/users")
        .meta({ name: "users.create", mcp: { description: "Create a user" } })
        .handle(() => created({ id: "u2" })),
      route
        .get("/health")
        .handle(() => ok({ ok: true })), // not MCP-exposed
    ],
  })
}

describe("@hyper/mcp", () => {
  test("manifest contains only mcp-annotated routes", () => {
    const a = buildApp()
    const srv = mcpServer(a)
    expect(srv.manifest.tools.map((t) => t.name).sort()).toEqual(["users.create", "users.list"])
  })

  test("tools/list over JSON-RPC", async () => {
    const a = buildApp()
    const srv = mcpServer(a)
    const res = await srv.handle(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    )
    const body = (await res.json()) as { result: { tools: { name: string }[] } }
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(["users.create", "users.list"])
  })

  test("tools/call funnels through app.invoke()", async () => {
    const a = buildApp()
    const srv = mcpServer(a)
    const res = await srv.handle(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "users.list", arguments: {} },
        }),
      }),
    )
    const body = (await res.json()) as {
      result: { content: { type: string; text: string }[] }
    }
    expect(JSON.parse(body.result.content[0]!.text)).toEqual([{ id: "u1" }])
  })

  test("tools/call POST with body", async () => {
    const a = buildApp()
    const srv = mcpServer(a)
    const res = await srv.handle(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "users.create", arguments: { body: { name: "Ada" } } },
        }),
      }),
    )
    const body = (await res.json()) as {
      result: { content: { text: string }[] }
    }
    expect(JSON.parse(body.result.content[0]!.text)).toEqual({ id: "u2" })
  })

  test("unknown tool returns JSON-RPC error", async () => {
    const a = buildApp()
    const srv = mcpServer(a)
    const res = await srv.handle(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "nope" },
        }),
      }),
    )
    const body = (await res.json()) as { error: { code: number } }
    expect(body.error.code).toBe(-32601)
  })

  test("authorize hook gates tool calls", async () => {
    const a = buildApp()
    const srv = mcpServer(a, { authorize: () => false })
    const res = await srv.handle(
      new Request("http://local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "users.list" },
        }),
      }),
    )
    const body = (await res.json()) as { error: { code: number } }
    expect(body.error.code).toBe(-32001)
  })

  test("auditMcp reports exposed count and auth hints", () => {
    const a = buildApp()
    const report = auditMcp(a)
    expect(report.exposedCount).toBe(2)
    expect(report.total).toBe(3)
  })
})
