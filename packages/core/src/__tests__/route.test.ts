import { describe, expect, test } from "bun:test"
import { app, route } from "../index.ts"
import type { StandardSchemaV1 } from "../standard-schema.ts"

// Minimal Standard Schema for tests so we don't depend on Zod at this layer.
function objectSchema<T extends Record<string, string>>(shape: T): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "hyper-test",
      validate(value) {
        if (typeof value !== "object" || value === null)
          return { issues: [{ message: "expected object" }] }
        const out: Record<string, unknown> = {}
        const issues: { message: string; path: string[] }[] = []
        for (const key of Object.keys(shape)) {
          const v = (value as Record<string, unknown>)[key]
          if (typeof v !== "string") issues.push({ message: "expected string", path: [key] })
          else out[key] = v
        }
        if (issues.length > 0) return { issues }
        return { value: out as T }
      },
    },
  }
}

describe("@usehyper/core route builder", () => {
  test("bare-data return becomes JSON 200", async () => {
    const r = route.get("/").handle(() => ({ ok: true }))
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("Response return is passed through", async () => {
    const r = route.get("/r").handle(() => new Response("hi", { status: 418 }))
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/r"))
    expect(res.status).toBe(418)
    expect(await res.text()).toBe("hi")
  })

  test("string return becomes text/plain", async () => {
    const r = route.get("/s").handle(() => "hello")
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/s"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    expect(await res.text()).toBe("hello")
  })

  test("params are parsed from the path", async () => {
    const r = route
      .get("/users/:id")
      .handle(({ params }) => ({ id: (params as { id: string }).id }))
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/users/abc"))
    expect(await res.json()).toEqual({ id: "abc" })
  })

  test("body validation + error mapping", async () => {
    const schema = objectSchema({ email: "string" })
    const r = route
      .post("/users")
      .body(schema)
      .handle(({ body }) => ({ ok: true, body }))
    const a = app({ routes: [r] })

    const ok = await a.fetch(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.com" }),
      }),
    )
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true, body: { email: "a@b.com" } })

    const bad = await a.fetch(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notEmail: 1 }),
      }),
    )
    expect(bad.status).toBe(400)
    const payload = (await bad.json()) as {
      error: { code: string; details?: { issues: unknown[] } }
    }
    expect(payload.error.code).toBe("validation_failed")
    expect(payload.error.details?.issues).toBeTruthy()
  })

  test("404 on missing route", async () => {
    const a = app({ routes: [] })
    const res = await a.fetch(new Request("http://localhost/nope"))
    expect(res.status).toBe(404)
  })

  test("default security headers present", async () => {
    const r = route.get("/").handle(() => "ok")
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("x-frame-options")).toBe("DENY")
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin")
    expect(res.headers.get("server")).toBeNull()
  })

  test("HSTS only on HTTPS + production (dev HTTPS localhost gets no HSTS)", async () => {
    const r = route.get("/").handle(() => "ok")
    const a = app({ routes: [r] })
    const httpRes = await a.fetch(new Request("http://localhost/"))
    expect(httpRes.headers.get("strict-transport-security")).toBeNull()
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const httpsRes = await a.fetch(new Request("https://localhost/"))
      expect(httpsRes.headers.get("strict-transport-security")).toContain("max-age=")
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  test("1 MB body limit triggers 413", async () => {
    const r = route.post("/upload").handle(({ body }) => ({ len: JSON.stringify(body).length }))
    const a = app({ routes: [r] })
    const bigStr = "x".repeat(2_000_000)
    const res = await a.fetch(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(bigStr.length + 10),
        },
        body: JSON.stringify({ x: bigStr }),
      }),
    )
    expect(res.status).toBe(413)
  })

  test("__proto__ in JSON body is rejected with 400", async () => {
    const r = route.post("/x").handle(({ body }) => ({ body }))
    const a = app({ routes: [r] })
    const res = await a.fetch(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"__proto__":{"polluted":true}}',
      }),
    )
    expect(res.status).toBe(400)
  })

  test("app.routes is a Bun.serve shape with all paths", () => {
    const a = app({
      routes: [route.get("/a").handle(() => "a"), route.get("/users/:id").handle(() => "u")],
    })
    expect(Object.keys(a.routes).sort()).toEqual(["/a", "/users/:id"])
    for (const v of Object.values(a.routes)) expect(typeof v).toBe("function")
  })
})
