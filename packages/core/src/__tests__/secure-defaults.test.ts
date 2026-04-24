import { describe, expect, test } from "bun:test"
import { app, createError, route } from "../index.ts"

describe("secure-defaults :: method-override guard", () => {
  const a = app({ routes: [route.get("/x").handle(() => ({ ok: true }))] })

  test("X-HTTP-Method-Override header → 400 method_override_rejected", async () => {
    const res = await a.fetch(
      new Request("http://local/x", { headers: { "x-http-method-override": "DELETE" } }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("method_override_rejected")
  })

  test("_method query param → 400", async () => {
    const res = await a.fetch(new Request("http://local/x?_method=DELETE"))
    expect(res.status).toBe(400)
  })

  test("opt-out via app({ security: { rejectMethodOverride: false } })", async () => {
    const a2 = app({
      routes: [route.get("/x").handle(() => ({ ok: true }))],
      security: { rejectMethodOverride: false },
    })
    const res = await a2.fetch(
      new Request("http://local/x", { headers: { "x-method-override": "DELETE" } }),
    )
    expect(res.status).toBe(200)
  })
})

describe("secure-defaults :: HSTS scope", () => {
  test("HTTP → no HSTS", async () => {
    const a = app({ routes: [route.get("/").handle(() => "ok")] })
    const res = await a.fetch(new Request("http://local/"))
    expect(res.headers.get("strict-transport-security")).toBeNull()
  })

  test("HTTPS + NODE_ENV=production → HSTS", async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const a = app({ routes: [route.get("/").handle(() => "ok")] })
      const res = await a.fetch(new Request("https://app.example.com/"))
      expect(res.headers.get("strict-transport-security")).toContain("max-age=")
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  test("HTTPS + NODE_ENV=development → no HSTS (dev domain safety)", async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "development"
    try {
      const a = app({ routes: [route.get("/").handle(() => "ok")] })
      const res = await a.fetch(new Request("https://localhost/"))
      expect(res.headers.get("strict-transport-security")).toBeNull()
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})

describe("secure-defaults :: per-route + global request timeout", () => {
  test(".timeout(10) + slow handler → 504 request_timeout", async () => {
    const a = app({
      routes: [
        route
          .get("/slow")
          .timeout(10)
          .handle(() => new Promise((r) => setTimeout(() => r({ ok: true }), 100))),
      ],
    })
    const res = await a.fetch(new Request("http://local/slow"))
    expect(res.status).toBe(504)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("request_timeout")
  })

  test("fast handler within timeout → 200", async () => {
    const a = app({
      routes: [
        route
          .get("/fast")
          .timeout(100)
          .handle(() => ({ ok: true })),
      ],
    })
    const res = await a.fetch(new Request("http://local/fast"))
    expect(res.status).toBe(200)
  })

  test("handler throws HyperError → passes through", async () => {
    const a = app({
      routes: [
        route.get("/boom").handle(() => {
          throw createError({ status: 418, code: "brewed", message: "I'm a teapot" })
        }),
      ],
    })
    const res = await a.fetch(new Request("http://local/boom"))
    expect(res.status).toBe(418)
  })
})
