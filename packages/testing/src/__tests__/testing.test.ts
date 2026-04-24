import { describe, expect, test } from "bun:test"
import { app, createError, created, ok, route } from "@usehyper/core"
import { signJwtHS256 } from "../auth.ts"
import { fuzzRoute } from "../fuzz.ts"
import {
  advanceTime,
  assertResponse,
  call,
  captureEvents,
  fakeRequest,
  memoryDb,
  memoryKv,
  memoryRateLimiter,
  mockPlugin,
  snapshotManifest,
  testClock,
  useTestClock,
} from "../index.ts"

const ping = route.get("/ping").handle(() => ok({ pong: true }))
const create = route.post("/todos").handle(({ req }) => {
  if (req.headers.get("x-fail") === "1") {
    throw createError({ status: 404, code: "missing", message: "not found" })
  }
  return created({ id: "t1", title: "x" })
})

function makeApp() {
  return app({ routes: [ping, create] })
}

describe("@usehyper/testing — request builders", () => {
  test("fakeRequest populates query + headers + body", async () => {
    const req = fakeRequest("POST", "/x", { json: { a: 1 }, query: { q: "hi" }, auth: "Bearer t" })
    expect(req.url).toContain("?q=hi")
    expect(req.headers.get("content-type")).toContain("application/json")
    expect(req.headers.get("authorization")).toBe("Bearer t")
    expect(await req.json()).toEqual({ a: 1 })
  })

  test("call() routes through app.fetch", async () => {
    const a = makeApp()
    const res = await call(a, "GET", "/ping")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pong: true })
  })
})

describe("@usehyper/testing — assertResponse", () => {
  test("hasStatus + hasJson + hasHeader chain", async () => {
    const res = await call(makeApp(), "GET", "/ping")
    const a = assertResponse(res).hasStatus(200).hasHeader("content-type", /json/)
    await a.hasJson({ pong: true })
  })

  test("isError narrows the envelope", async () => {
    const res = await call(makeApp(), "POST", "/todos", { json: {}, headers: { "x-fail": "1" } })
    await assertResponse(res).isError({ status: 404, code: "missing" })
  })
})

describe("@usehyper/testing — memory stores", () => {
  test("memoryKv honors TTL via the injected clock", async () => {
    const clock = testClock(1000)
    const kv = memoryKv<number>(clock)
    await kv.set("k", 42, 100)
    expect(await kv.get("k")).toBe(42)
    clock.advance(200)
    expect(await kv.get("k")).toBeUndefined()
  })

  test("memoryRateLimiter rolls the window at expiry", async () => {
    const clock = testClock(0)
    const l = memoryRateLimiter({ limit: 2, windowMs: 1000, clock })
    expect((await l.check("x")).allowed).toBe(true)
    expect((await l.check("x")).allowed).toBe(true)
    expect((await l.check("x")).allowed).toBe(false)
    clock.advance(1001)
    expect((await l.check("x")).allowed).toBe(true)
  })

  test("memoryDb supports insert/find/update", () => {
    const db = memoryDb()
    const users = db.table<{ id: string; age: number }>("users")
    users.insert({ id: "u1", age: 30 })
    users.insert({ id: "u2", age: 40 })
    expect(users.find((u) => u.id === "u1")?.age).toBe(30)
    users.update((u) => u.id === "u1", { age: 31 })
    expect(users.find((u) => u.id === "u1")?.age).toBe(31)
    expect(users.filter((u) => u.age > 30).length).toBe(2)
  })
})

describe("@usehyper/testing — test clock", () => {
  test("ambient clock + advanceTime() work together", () => {
    const clock = testClock(500)
    useTestClock(clock)
    advanceTime(1000)
    expect(clock.now()).toBe(1500)
  })
})

describe("@usehyper/testing — app.test() + captureEvents + mockPlugin", () => {
  test("captureEvents records per-request wide events", async () => {
    const { app: a, capture } = captureEvents(makeApp())
    await call(a, "GET", "/ping")
    await call(a, "GET", "/ping")
    expect(capture.events.length).toBe(2)
    expect(capture.has({ method: "GET", path: "/ping", status: 200 })).toBe(true)
  })

  test("mockPlugin can short-circuit via preRoute", async () => {
    const base = makeApp()
    const a = base.test({
      plugins: {
        add: [
          mockPlugin({
            name: "stub",
            request: { preRoute: () => new Response("bonked", { status: 418 }) },
          }),
        ],
      },
    })
    const res = await a.fetch(fakeRequest("GET", "/ping"))
    expect(res.status).toBe(418)
    expect(await res.text()).toBe("bonked")
  })

  test("app.test({ plugins: { skip } }) removes named plugins", async () => {
    const base = app({
      routes: [ping],
      plugins: [
        { name: "alpha", request: { preRoute: () => new Response("blocked", { status: 403 }) } },
      ],
    })
    expect((await base.fetch(fakeRequest("GET", "/ping"))).status).toBe(403)
    const cleared = base.test({ plugins: { skip: ["alpha"] } })
    expect((await cleared.fetch(fakeRequest("GET", "/ping"))).status).toBe(200)
  })
})

describe("@usehyper/testing — snapshots + fuzz", () => {
  test("snapshotManifest covers all three projections", () => {
    const snap = snapshotManifest(makeApp())
    expect(snap.openapi).toBeDefined()
    expect(snap.mcp).toBeDefined()
    expect(snap.client).toBeDefined()
  })

  test("fuzzRoute: framework never 500s against the attack corpus", async () => {
    const report = await fuzzRoute(makeApp(), "POST /todos")
    expect(report.ok).toBe(true)
  })
})

describe("@usehyper/testing/auth", () => {
  test("signJwtHS256 produces a verifiable-looking token", () => {
    const token = signJwtHS256({
      secret: "x".repeat(32),
      payload: { sub: "u1" },
      expiresInMs: 60_000,
    })
    expect(token.split(".").length).toBe(3)
    const [, p] = token.split(".") as [string, string, string]
    const payload = JSON.parse(Buffer.from(p, "base64").toString("utf8"))
    expect(payload.sub).toBe("u1")
    expect(typeof payload.exp).toBe("number")
  })
})
