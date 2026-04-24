import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { DevRecorder, devMcpPlugin } from "../index.ts"

describe("@hyper/dev-mcp", () => {
  const hi = route
    .get("/hi")
    .meta({ name: "hi" })
    .handle(() => "hi")
  const secret = route
    .get("/__secret")
    .meta({ internal: true })
    .handle(() => "s")
  const recorder = new DevRecorder()
  const a = app({
    routes: [hi, secret],
    plugins: [devMcpPlugin({ enabled: true, recorder })],
  })

  async function call(
    method: string,
    params?: unknown,
  ): Promise<{ result?: unknown; error?: unknown }> {
    const res = await a.fetch(
      new Request("http://local/.hyper/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    )
    return (await res.json()) as { result?: unknown; error?: unknown }
  }

  test("initialize advertises tools capability", async () => {
    const r = await call("initialize")
    expect((r.result as { serverInfo?: { name: string } }).serverInfo?.name).toBe("hyper-dev")
  })

  test("tools/list exposes core introspection tools", async () => {
    const r = await call("tools/list")
    const names = (r.result as { tools: { name: string }[] }).tools.map((t) => t.name).sort()
    expect(names).toEqual([
      "get_route",
      "invoke_route",
      "list_routes",
      "recent_errors",
      "recent_requests",
      "replay_request",
    ])
  })

  test("list_routes omits internal routes", async () => {
    const r = await call("tools/call", { name: "list_routes" })
    const routes = (
      r.result as {
        structuredContent: { path: string }[]
      }
    ).structuredContent
    expect(routes.map((x) => x.path)).toEqual(["/hi"])
  })

  test("recent_requests records handled requests", async () => {
    await a.fetch(new Request("http://local/hi"))
    const r = await call("tools/call", {
      name: "recent_requests",
      arguments: { limit: 10 },
    })
    const list = (r.result as { structuredContent: { path: string }[] }).structuredContent
    expect(list[0]?.path).toBe("/hi")
  })

  test("invoke_route runs the handler in-process", async () => {
    const r = await call("tools/call", {
      name: "invoke_route",
      arguments: { method: "GET", path: "/hi" },
    })
    const invoked = (r.result as { structuredContent: { status: number; data: string } })
      .structuredContent
    expect(invoked.status).toBe(200)
    expect(invoked.data).toBe("hi")
  })

  test("plugin is a no-op when disabled", async () => {
    const quiet = app({
      routes: [hi],
      plugins: [devMcpPlugin({ enabled: false })],
    })
    const res = await quiet.fetch(
      new Request("http://local/.hyper/mcp", { method: "POST", body: "{}" }),
    )
    expect(res.status).toBe(404)
  })
})
