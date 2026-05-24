/**
 * Smoke tests for the in-app registry routes.
 *
 * The handlers are plain async functions that return `Response`, so we can
 * exercise them directly without spinning up Next's dev/runtime — much
 * faster + lets these run as part of the workspace `bun test` invocation.
 */

import { describe, expect, test } from "bun:test"
import { GET as healthzGET } from "../app/healthz/route"
import { GET as componentGET } from "../app/r/[file]/route"
import { GET as indexGET } from "../app/r/index.json/route"
import { GET as schemaAliasGET } from "../app/schema.json/route"
import { GET as schemaGET } from "../app/schema/[file]/route"
import { GET as mcpGET, POST as mcpPOST } from "../app/mcp/route"
import { loadManifests } from "../lib/manifests"

const dummyReq = new Request("http://localhost/")

function ctx(file: string): { params: Promise<{ file: string }> } {
  return { params: Promise.resolve({ file }) }
}

describe("loadManifests", () => {
  test("returns a non-empty index", async () => {
    const { index, byName } = await loadManifests()
    expect(index.components.length).toBeGreaterThan(0)
    expect(byName.size).toBe(index.components.length)
    for (const c of index.components) expect(byName.has(c.name)).toBe(true)
  })

  test("includes core", async () => {
    const { byName } = await loadManifests()
    expect(byName.has("core")).toBe(true)
  })
})

describe("/r", () => {
  test("/r/index.json returns the catalog with $schema", async () => {
    const res = await indexGET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("s-maxage=300")
    const body = (await res.json()) as { $schema: string; schema: 1; components: unknown[] }
    expect(body.$schema).toBe("https://hyperjs.ai/schema/registry.json")
    expect(body.components.length).toBeGreaterThan(0)
  })

  test("/r/<name>.json returns the latest manifest", async () => {
    const res = await componentGET(dummyReq, ctx("core.json"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string; version: string }
    expect(body.name).toBe("core")
    expect(body.version).toMatch(/^\d/)
  })

  test("/r/<name>@<version>.json returns immutable manifest", async () => {
    const live = await (await componentGET(dummyReq, ctx("core.json"))).json()
    const v = (live as { version: string }).version
    const res = await componentGET(dummyReq, ctx(`core@${v}.json`))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("immutable")
  })

  test("/r/<name>@<bad>.json 404s with the latest hint", async () => {
    const res = await componentGET(dummyReq, ctx("core@9.9.9.json"))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; latest: string }
    expect(body.error).toContain("9.9.9")
    expect(body.latest).toMatch(/^\d/)
  })

  test("/r/<unknown>.json 404s", async () => {
    const res = await componentGET(dummyReq, ctx("nope-not-real.json"))
    expect(res.status).toBe(404)
  })
})

describe("/schema", () => {
  test("/schema.json (alias) is the hyper-config schema", async () => {
    const res = schemaAliasGET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { title: string }
    expect(body.title).toBe("hyper.config.json")
  })

  test("/schema/registry.json", async () => {
    const res = await schemaGET(dummyReq, ctx("registry.json"))
    expect(res.status).toBe(200)
  })

  test("/schema/<unknown>.json 404s", async () => {
    const res = await schemaGET(dummyReq, ctx("doesnt-exist.json"))
    expect(res.status).toBe(404)
  })
})

describe("/healthz", () => {
  test("returns 200 ok", async () => {
    const res = healthzGET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

describe("/mcp", () => {
  test("GET returns the help/tool catalog", async () => {
    const res = await mcpGET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tools: { name: string }[] }
    const names = body.tools.map((t) => t.name)
    expect(names).toContain("listComponents")
    expect(names).toContain("searchComponent")
    expect(names).toContain("getComponent")
    expect(names).toContain("previewComponent")
    expect(names).toContain("getReadme")
  })

  test("POST tools/list", async () => {
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    const res = await mcpPOST(req)
    const body = (await res.json()) as { result: { tools: { name: string }[] } }
    expect(body.result.tools.length).toBeGreaterThanOrEqual(5)
  })

  test("POST tools/call searchComponent", async () => {
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "searchComponent", arguments: { q: "cors" } },
      }),
    })
    const res = await mcpPOST(req)
    const body = (await res.json()) as { result: { content: { text: string }[] } }
    const items = JSON.parse(body.result.content[0]!.text) as { name: string }[]
    expect(items.some((c) => c.name === "cors")).toBe(true)
  })

  test("POST tools/call getComponent core", async () => {
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "getComponent", arguments: { name: "core" } },
      }),
    })
    const res = await mcpPOST(req)
    const body = (await res.json()) as { result: { content: { text: string }[] } }
    const m = JSON.parse(body.result.content[0]!.text) as {
      name: string
      files: unknown[]
    }
    expect(m.name).toBe("core")
    expect(Array.isArray(m.files)).toBe(true)
    expect(m.files.length).toBeGreaterThan(0)
  })
})
