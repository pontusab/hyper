import { describe, expect, test } from "bun:test"
import { app, fromPlainRouter, group, ok, route } from "../index.ts"

describe("group composition", () => {
  test("prefix rewrites route paths", async () => {
    const g = group("/api").add(
      route.get("/users").handle(() => ok({ list: [] })),
      route.get("/users/:id").handle(({ params }) => ok({ id: (params as { id: string }).id })),
    )

    const a = app({ groups: [g] })
    const r1 = await a.fetch(new Request("http://localhost/api/users"))
    expect(r1.status).toBe(200)
    const r2 = await a.fetch(new Request("http://localhost/api/users/42"))
    expect(await r2.json()).toEqual({ id: "42" })
  })

  test("group.use prepends middleware to every route", async () => {
    const calls: string[] = []
    const g = group("/api")
      .use(async ({ next }) => {
        calls.push("group-mw")
        return next()
      })
      .add(route.get("/ping").handle(() => "pong"))

    const a = app({ groups: [g] })
    const res = await a.fetch(new Request("http://localhost/api/ping"))
    expect(res.status).toBe(200)
    expect(calls).toEqual(["group-mw"])
  })

  test("group.call invokes in-process", async () => {
    const g = group().add(route.post("/users").handle(({ body }) => ({ got: body })))
    const result = (await g.call("POST", "/users", { body: { x: 1 } })) as { got: unknown }
    expect(result.got).toEqual({ x: 1 })
  })

  test("merge combines two groups", async () => {
    const a1 = group("/v1").add(route.get("/a").handle(() => "a"))
    const a2 = group("/v1")
      .add(route.get("/b").handle(() => "b"))
      .merge(a1)
    const app1 = app({ groups: [a2] })
    const r = await app1.fetch(new Request("http://localhost/v1/a"))
    expect(r.status).toBe(200)
    expect(await r.text()).toBe("a")
  })

  test("plain-object router — nested keys become a group tree", async () => {
    const router = {
      users: {
        list: route.get("/users").handle(() => ok({ list: [] })),
        get: route
          .get("/users/:id")
          .handle(({ params }) => ok({ id: (params as { id: string }).id })),
      },
      health: route.get("/health").handle(() => "ok"),
    }
    const a = app({ router })
    expect((await a.fetch(new Request("http://localhost/users"))).status).toBe(200)
    expect((await a.fetch(new Request("http://localhost/health"))).status).toBe(200)
  })

  test("fromPlainRouter helper returns a GroupBuilder", () => {
    const g = fromPlainRouter({ health: route.get("/health").handle(() => "ok") })
    const built = g.build()
    expect(built.routes).toHaveLength(1)
  })
})
