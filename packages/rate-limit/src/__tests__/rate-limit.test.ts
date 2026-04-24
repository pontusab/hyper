import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { authRateLimitPlugin, rateLimit } from "../index.ts"

describe("@hyper/rate-limit", () => {
  test("429s after limit is reached, with Retry-After", async () => {
    const r = route
      .get("/")
      .use(rateLimit({ window: "1m", limit: 2, key: () => "single" }))
      .handle(() => "ok")
    const a = app({ routes: [r] })
    const r1 = await a.fetch(new Request("http://local/"))
    expect(r1.status).toBe(200)
    expect(r1.headers.get("ratelimit-remaining")).toBe("1")
    const r2 = await a.fetch(new Request("http://local/"))
    expect(r2.status).toBe(200)
    const r3 = await a.fetch(new Request("http://local/"))
    expect(r3.status).toBe(429)
    expect(r3.headers.get("retry-after")).toBeTruthy()
  })
})

describe("@hyper/rate-limit :: authRateLimitPlugin", () => {
  test("auto-limits routes declaring meta.authEndpoint = true", async () => {
    const login = route
      .post("/auth/login")
      .meta({ authEndpoint: true })
      .handle(() => ({ ok: true }))
    const unprotected = route.post("/public").handle(() => ({ ok: true }))
    const a = app({
      routes: [login, unprotected],
      plugins: [authRateLimitPlugin({ limit: 2, window: "1m" })],
    })
    const hits = async (path: string) =>
      a.fetch(
        new Request(`http://local${path}`, {
          method: "POST",
          headers: { "x-forwarded-for": "1.1.1.1" },
        }),
      )

    expect((await hits("/auth/login")).status).toBe(200)
    expect((await hits("/auth/login")).status).toBe(200)
    const r3 = await hits("/auth/login")
    expect(r3.status).toBe(429)
    const body = (await r3.json()) as { error: { code: string; details: { retryAfter: number } } }
    expect(body.error.code).toBe("rate_limit_exceeded")
    expect(body.error.details.retryAfter).toBeGreaterThan(0)

    for (let i = 0; i < 5; i++) expect((await hits("/public")).status).toBe(200)
  })

  test("different routes share independent buckets", async () => {
    const login = route
      .post("/auth/login")
      .meta({ authEndpoint: true })
      .handle(() => ({ ok: true }))
    const reset = route
      .post("/auth/reset")
      .meta({ authEndpoint: true })
      .handle(() => ({ ok: true }))
    const a = app({
      routes: [login, reset],
      plugins: [authRateLimitPlugin({ limit: 1, window: "1m" })],
    })
    const call = async (p: string) =>
      a.fetch(
        new Request(`http://local${p}`, {
          method: "POST",
          headers: { "x-forwarded-for": "2.2.2.2" },
        }),
      )
    expect((await call("/auth/login")).status).toBe(200)
    expect((await call("/auth/reset")).status).toBe(200)
    expect((await call("/auth/login")).status).toBe(429)
  })
})
