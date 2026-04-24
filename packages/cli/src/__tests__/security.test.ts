import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { auditApp } from "../commands/security.ts"

describe("hyper security --check — auditApp", () => {
  test("clean app passes", async () => {
    const a = app({ routes: [route.get("/").handle(() => "ok")] })
    const findings = await auditApp(a)
    const failed = findings.filter((f) => f.level === "fail")
    expect(failed).toEqual([])
  })

  test("fails when default headers are disabled", async () => {
    const a = app({
      routes: [route.get("/").handle(() => "ok")],
      security: { headers: false },
    })
    const findings = await auditApp(a)
    const f = findings.find((x) => x.id === "sec-headers")!
    expect(f.level).toBe("fail")
  })

  test("fails when method-override guard is off", async () => {
    const a = app({
      routes: [route.get("/").handle(() => "ok")],
      security: { rejectMethodOverride: false },
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-method-override")!
    expect(f.level).toBe("fail")
  })

  test("flags authEndpoint routes with no authRateLimitPlugin", async () => {
    const a = app({
      routes: [
        route
          .post("/login")
          .meta({ authEndpoint: true })
          .handle(() => ({ ok: true })),
      ],
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-auth-rate")!
    expect(f.level).toBe("fail")
  })

  test("warns on excessive body limit", async () => {
    const a = app({
      routes: [route.get("/").handle(() => "ok")],
      security: { bodyLimitBytes: 100 * 1_048_576 },
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-body-limit")!
    expect(f.level).toBe("warn")
  })

  test("warns when session() middleware is present on a mutating route without csrfGuard()", async () => {
    const fakeSession: import("@hyper/core").Middleware = Object.assign(
      async ({ next }: { next: () => Promise<unknown> }) => next() as Promise<Response>,
      { __hyperTag: "@hyper/session" },
    ) as unknown as import("@hyper/core").Middleware
    const a = app({
      routes: [
        route
          .post("/profile")
          .use(fakeSession)
          .handle(() => ({ ok: true })),
      ],
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-csrf")!
    expect(f.level).toBe("warn")
    expect(f.fix).toContain("POST /profile")
  })

  test("passes sec-csrf when session + csrfGuard are chained", async () => {
    const fakeSession: import("@hyper/core").Middleware = Object.assign(
      async ({ next }: { next: () => Promise<unknown> }) => next() as Promise<Response>,
      { __hyperTag: "@hyper/session" },
    ) as unknown as import("@hyper/core").Middleware
    const fakeCsrf: import("@hyper/core").Middleware = Object.assign(
      async ({ next }: { next: () => Promise<unknown> }) => next() as Promise<Response>,
      { __hyperTag: "@hyper/session:csrf" },
    ) as unknown as import("@hyper/core").Middleware
    const a = app({
      routes: [
        route
          .post("/profile")
          .use(fakeSession)
          .use(fakeCsrf)
          .handle(() => ({ ok: true })),
      ],
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-csrf")!
    expect(f.level).toBe("pass")
  })

  test("does not emit sec-csrf when session middleware is absent", async () => {
    const a = app({
      routes: [route.post("/anything").handle(() => ({ ok: true }))],
    })
    const f = (await auditApp(a)).find((x) => x.id === "sec-csrf")
    expect(f).toBeUndefined()
  })
})
