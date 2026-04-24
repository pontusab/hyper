import { describe, expect, test } from "bun:test"
import { app, route } from "../index.ts"

describe("route.staticResponse() + Bun.serve native static routes", () => {
  test("serves a static Response unchanged through fetch()", async () => {
    const r = route.get("/health").staticResponse(Response.json({ ok: true }, { status: 200 }))
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://local/health"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("routes map projects the static Response directly (not a fn)", () => {
    const r = route.get("/robots.txt").staticResponse(
      new Response("User-agent: *\nDisallow:\n", {
        headers: { "content-type": "text/plain" },
      }),
    )
    const a = app({ routes: [r] })
    expect(a.routes["/robots.txt"]).toBeInstanceOf(Response)
  })

  test("tags kind='static' on the route list", () => {
    const r = route.get("/x").staticResponse(new Response("ok"))
    const a = app({ routes: [r] })
    const only = a.routeList[0]!
    expect(only.kind).toBe("static")
    expect(only.staticResponse).toBeInstanceOf(Response)
  })
})
