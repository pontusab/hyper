import { describe, expect, test } from "bun:test"
import { app, resource, route, runExamples } from "../index.ts"

describe("resource()", () => {
  test("emits list/get/create/update/remove when handlers provided", async () => {
    interface User {
      id: string
      name: string
    }
    const store = new Map<string, User>([["u1", { id: "u1", name: "Ada" }]])
    const users = resource<User>(
      "/users",
      {
        list: () => Array.from(store.values()),
        get: ({ params }) => store.get(params.id) ?? null,
        create: ({ body }) => {
          const u = { id: crypto.randomUUID(), name: body.name }
          store.set(u.id, u)
          return u
        },
        remove: ({ params }) => store.delete(params.id),
      },
      { name: "users", mcp: true },
    )

    const a = app({ routes: users })
    expect(a.routeList.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "DELETE /users/:id",
      "GET /users",
      "GET /users/:id",
      "POST /users",
    ])

    const list = await a.invoke({ method: "GET", path: "/users" })
    expect(list.status).toBe(200)
    expect((list.data as { id: string }[])[0]!.id).toBe("u1")

    const get = await a.invoke({ method: "GET", path: "/users/:id", params: { id: "u1" } })
    expect((get.data as { name: string }).name).toBe("Ada")

    const mcp = a.toMCPManifest()
    expect(mcp.tools.map((t) => t.name).sort()).toEqual([
      "users.create",
      "users.get",
      "users.list",
      "users.remove",
    ])
  })
})

describe(".deprecated() / .version() / .example()", () => {
  test(".deprecated() adds Sunset header + OpenAPI deprecated", async () => {
    const r = route
      .get("/legacy")
      .deprecated({ sunset: new Date("2027-01-01T00:00:00Z"), reason: "use /v2" })
      .handle(() => ({ ok: true }))
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://local/legacy"))
    expect(res.headers.get("Sunset")).toBeTruthy()
    const oa = a.toOpenAPI()
    expect(oa.paths["/legacy"]!.get?.deprecated).toBe(true)
  })

  test(".version() tags meta.version", () => {
    const r = route
      .get("/x")
      .version("v2")
      .handle(() => ({ ok: true }))
    const a = app({ routes: [r] })
    expect(a.routeList[0]!.meta.version).toBe("v2")
  })

  test(".example() contract tests run via runExamples()", async () => {
    const r = route
      .get("/greet/:name")
      .example({
        name: "greets ada",
        input: { params: { name: "Ada" } },
        output: { status: 200, body: { hello: "Ada" } },
      })
      .handle(({ params }) => ({ hello: params.name }))
    const a = app({ routes: [r] })
    const results = await runExamples(a)
    expect(results).toHaveLength(1)
    expect(results[0]!.ok).toBe(true)
  })

  test("runExamples reports failures", async () => {
    const r = route
      .get("/x")
      .example({ name: "wrong", output: { status: 404 } })
      .handle(() => ({ ok: true }))
    const a = app({ routes: [r] })
    const results = await runExamples(a)
    expect(results[0]!.ok).toBe(false)
    expect(results[0]!.status).toBe(200)
  })
})
