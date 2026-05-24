import { describe, expect, test } from "bun:test"
import { runExamples } from "@hyper/core"
import { mcpServer } from "@hyper/mcp"
import a from "../src/app.ts"

describe("ai example", () => {
  test(".example() contract tests pass", async () => {
    const results = await runExamples(a)
    expect(results.every((r) => r.ok)).toBe(true)
  })

  test("exposes notes.list/create/search as MCP tools", () => {
    const srv = mcpServer(a)
    expect(srv.manifest.tools.map((t) => t.name).sort()).toEqual([
      "notes.create",
      "notes.list",
      "notes.search",
    ])
  })

  test("invoking a tool funnels through app.invoke() (same path as HTTP)", async () => {
    const srv = mcpServer(a)
    // Seed a note via MCP.
    await srv.callTool("notes.create", {
      body: { title: "hello", content: "world" },
    })
    // Search via MCP.
    const found = (await srv.callTool("notes.search", { query: { q: "hello" } })) as readonly {
      title: string
    }[]
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]!.title).toBe("hello")

    // And verify it's the same surface via HTTP.
    const httpList = await a.fetch(new Request("http://local/notes"))
    const json = (await httpList.json()) as readonly { title: string }[]
    expect(json.some((n) => n.title === "hello")).toBe(true)
  })
})
