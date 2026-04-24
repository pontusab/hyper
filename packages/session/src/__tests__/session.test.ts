import { describe, expect, test } from "bun:test"
import { app, route } from "@usehyper/core"
import { csrfGuard, memorySessions, session, validateSessionSecret } from "../index.ts"

const SECRET = "s".repeat(32)

describe("@usehyper/session", () => {
  const store = memorySessions()
  const mw = session({ secret: SECRET, secure: false, store })
  const login = route
    .post("/login")
    .use(mw)
    .handle((c) => {
      c.ctx.session?.set("userId", "u-1")
      return { ok: true }
    })
  const me = route
    .get("/me")
    .use(mw)
    .handle((c) => ({ userId: c.ctx.session?.get<string>("userId") ?? null }))
  const a = app({ routes: [login, me] })

  test("issues signed cookie and round-trips data", async () => {
    const r1 = await a.fetch(new Request("http://local/login", { method: "POST" }))
    const cookie = r1.headers.get("set-cookie")
    expect(cookie).toContain("hyper.sid=")
    expect(cookie).toContain("HttpOnly")
    const c = cookie!.split(";")[0]!
    const r2 = await a.fetch(new Request("http://local/me", { headers: { cookie: c } }))
    const b = (await r2.json()) as { userId: string | null }
    expect(b.userId).toBe("u-1")
  })

  test("tampered cookie yields no session", async () => {
    const r = await a.fetch(
      new Request("http://local/me", { headers: { cookie: "hyper.sid=tampered.value" } }),
    )
    const b = (await r.json()) as { userId: string | null }
    expect(b.userId ?? null).toBe(null)
  })

  test("validateSessionSecret: short secrets throw", () => {
    expect(() => validateSessionSecret("short")).toThrow(/minimum is 32/)
  })

  test("session({ secret: short }) refuses to install", () => {
    expect(() => session({ secret: "short", secure: false })).toThrow(/minimum is 32/)
  })
})

describe("@usehyper/session CSRF double-submit", () => {
  const store = memorySessions()
  const mw = session({ secret: SECRET, secure: false, store })
  const csrf = csrfGuard({ secure: false })
  const login = route
    .post("/login")
    .use(mw)
    .use(csrf)
    .handle((c) => {
      c.ctx.session?.set("uid", "u1")
      return { ok: true }
    })
  const mutate = route
    .post("/mutate")
    .use(mw)
    .use(csrf)
    .handle(() => ({ mutated: true }))
  const safe = route
    .get("/safe")
    .use(mw)
    .use(csrf)
    .handle(() => ({ safe: true }))
  const a = app({ routes: [login, mutate, safe] })

  test("issues a csrf cookie alongside the session cookie on login", async () => {
    const r = await a.fetch(new Request("http://local/login", { method: "POST" }))
    const setCookies = r.headers.getSetCookie()
    expect(setCookies.some((c) => c.startsWith("hyper.sid="))).toBe(true)
    expect(setCookies.some((c) => c.startsWith("csrf="))).toBe(true)
  })

  test("POST without matching x-csrf-token is rejected 403", async () => {
    const r1 = await a.fetch(new Request("http://local/login", { method: "POST" }))
    const sid = r1.headers
      .getSetCookie()
      .find((c) => c.startsWith("hyper.sid="))!
      .split(";")[0]!
    const csrf = r1.headers
      .getSetCookie()
      .find((c) => c.startsWith("csrf="))!
      .split(";")[0]!
    const r2 = await a.fetch(
      new Request("http://local/mutate", {
        method: "POST",
        headers: { cookie: `${sid}; ${csrf}` },
      }),
    )
    expect(r2.status).toBe(403)
    const body = (await r2.json()) as { error: { code: string } }
    expect(body.error.code).toBe("csrf_token_mismatch")
  })

  test("POST with matching x-csrf-token passes", async () => {
    const r1 = await a.fetch(new Request("http://local/login", { method: "POST" }))
    const sid = r1.headers
      .getSetCookie()
      .find((c) => c.startsWith("hyper.sid="))!
      .split(";")[0]!
    const csrfPair = r1.headers
      .getSetCookie()
      .find((c) => c.startsWith("csrf="))!
      .split(";")[0]!
    const csrfValue = csrfPair.split("=", 2)[1]!
    const r2 = await a.fetch(
      new Request("http://local/mutate", {
        method: "POST",
        headers: { cookie: `${sid}; ${csrfPair}`, "x-csrf-token": csrfValue },
      }),
    )
    expect(r2.status).toBe(200)
  })

  test("GET never requires csrf token", async () => {
    const r1 = await a.fetch(new Request("http://local/login", { method: "POST" }))
    const sid = r1.headers
      .getSetCookie()
      .find((c) => c.startsWith("hyper.sid="))!
      .split(";")[0]!
    const r2 = await a.fetch(new Request("http://local/safe", { headers: { cookie: sid } }))
    expect(r2.status).toBe(200)
  })
})
