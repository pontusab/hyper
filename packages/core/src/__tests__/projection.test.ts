import { describe, expect, test } from "bun:test"
import { app, created, notFound, ok, route } from "../index.ts"

describe("projection", () => {
  const health = route
    .get("/health")
    .meta({ name: "health" })
    .handle(() => ok({ ok: true }))
  const list = route
    .get("/users")
    .meta({ name: "listUsers", tags: ["users"], mcp: { description: "List users" } })
    .handle(() => ok([]))
  const create = route
    .post("/users")
    .meta({ name: "createUser" })
    .handle(() => created({ id: "u1" }))
  const hidden = route
    .get("/admin/internal")
    .meta({ internal: true })
    .handle(() => notFound({}))
  const a = app({ routes: [health, list, create, hidden] })

  test("toClientManifest returns the route graph (sans internal)", () => {
    const m = a.toClientManifest()
    expect(m.version).toBe("1.0")
    expect(m.routes.map((r) => r.path)).toEqual(["/health", "/users", "/users"])
    expect(m.routes.some((r) => r.path === "/admin/internal")).toBe(false)
  })

  test("toOpenAPI produces OpenAPI 3.1 with path template conversion", () => {
    const withParam = route
      .get("/users/:id")
      .meta({ name: "getUser" })
      .handle(() => ok({ id: "u1" }))
    const b = app({ routes: [withParam] })
    const doc = b.toOpenAPI({ title: "Test", version: "1.0.0" })
    expect(doc.openapi).toBe("3.1.0")
    expect(doc.info.title).toBe("Test")
    expect(doc.paths["/users/{id}"]).toBeDefined()
    expect(doc.paths["/users/{id}"]!.get?.operationId).toBe("getUser")
  })

  test("toMCPManifest only exports meta.mcp routes", () => {
    const m = a.toMCPManifest()
    expect(m.tools.map((t) => t.name)).toEqual(["listUsers"])
    expect(m.tools[0]!.description).toBe("List users")
  })

  test("invoke() shares the HTTP pipeline", async () => {
    const echo = route.post("/echo").handle(() => ok({ ok: true }))
    const b = app({ routes: [echo] })
    const r = await b.invoke({ method: "POST", path: "/echo", body: { a: 1 } })
    expect(r.status).toBe(200)
    expect(r.data).toEqual({ ok: true })
  })

  test("invoke() returns {status,data,headers} on 404", async () => {
    const r = await a.invoke({ method: "GET", path: "/nope" })
    expect(r.status).toBe(404)
  })
})
