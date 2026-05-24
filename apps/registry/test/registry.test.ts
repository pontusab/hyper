import { describe, expect, test } from "bun:test"
import { loadManifests } from "../src/manifests.ts"
import { handleMcp } from "../src/mcp.ts"
import { renderComponentPage } from "../src/pages/component.ts"
import { renderHome } from "../src/pages/home.ts"

describe("registry app", () => {
  test("loadManifests returns the index + every component", async () => {
    const { index, byName } = await loadManifests()
    expect(index.components.length).toBeGreaterThan(0)
    expect(byName.size).toBe(index.components.length)
    for (const c of index.components) {
      expect(byName.has(c.name)).toBe(true)
    }
  })

  test("renderHome includes the install command", async () => {
    const { index } = await loadManifests()
    const html = renderHome(index)
    expect(html).toContain("hyper add")
    expect(html).toContain("https://hyperjs.ai/mcp")
    expect(html).toContain("/c/core")
  })

  test("renderComponentPage renders a known component", async () => {
    const { byName } = await loadManifests()
    const cors = byName.get("cors")!
    expect(cors).toBeDefined()
    const html = renderComponentPage(cors)
    expect(html).toContain("hyper add cors")
    expect(html).toContain("/r/cors.json")
  })
})

describe("MCP endpoint", () => {
  test("GET /mcp returns the help/tool catalog", async () => {
    const res = await handleMcp(new Request("http://localhost/mcp"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tools: { name: string }[] }
    const names = body.tools.map((t) => t.name)
    expect(names).toContain("listComponents")
    expect(names).toContain("searchComponent")
    expect(names).toContain("getComponent")
    expect(names).toContain("previewComponent")
    expect(names).toContain("getReadme")
  })

  test("tools/list", async () => {
    const res = await handleMcp(
      new Request("http://localhost/mcp", { method: "POST", body: "{}" }),
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    )
    const body = (await res.json()) as { result: { tools: { name: string }[] } }
    expect(body.result.tools.length).toBeGreaterThanOrEqual(5)
  })

  test("tools/call searchComponent", async () => {
    const res = await handleMcp(
      new Request("http://localhost/mcp", { method: "POST", body: "{}" }),
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "searchComponent", arguments: { q: "cors" } },
      },
    )
    const body = (await res.json()) as { result: { content: { text: string }[] } }
    const items = JSON.parse(body.result.content[0]!.text)
    expect(items.some((c: { name: string }) => c.name === "cors")).toBe(true)
  })

  test("tools/call getComponent core", async () => {
    const res = await handleMcp(
      new Request("http://localhost/mcp", { method: "POST", body: "{}" }),
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "getComponent", arguments: { name: "core" } },
      },
    )
    const body = (await res.json()) as { result: { content: { text: string }[] } }
    const m = JSON.parse(body.result.content[0]!.text)
    expect(m.name).toBe("core")
    expect(Array.isArray(m.files)).toBe(true)
    expect(m.files.length).toBeGreaterThan(0)
  })
})
