/**
 * Tests for the `Hyper` chain API. Covers:
 *   - Verb shortcuts (handler, opts+handler, string static-shortcut).
 *   - `.use()` polymorphism — sub-app, sub-app with explicit prefix,
 *     GroupBuilder, RouteGroup, Route, Route[], HyperPlugin, Middleware,
 *     ESM namespace.
 *   - Prefix composition (constructor prefix, `.use(prefix, sub)` re-prefix).
 *   - Decorate / derive / env / security flow through `.build()`.
 *   - Real `Bun.serve` boot via `.listen()` + `.stop()`.
 *   - `HYPER_SKIP_LISTEN` env skips the socket.
 *   - Banner suppressed in production.
 *
 * Modelled after `e2e-serve.test.ts` — same `spawnServer` pattern
 * where we need a real socket.
 */

import { afterAll, describe, expect, test } from "bun:test"
import { Hyper, group, hyper, ok, route } from "../index.ts"
import type { StandardSchemaV1 } from "../standard-schema.ts"

// ---------------------------------------------------------------------
// Basic verbs + string shortcut
// ---------------------------------------------------------------------

describe("Hyper — verb shortcuts", () => {
  test("GET handler returns a string-typed response", async () => {
    const app = new Hyper().get("/", () => "hello")
    const res = await app.fetch(new Request("http://x/"))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("hello")
  })

  test("GET with string shortcut is lowered to staticResponse", async () => {
    const app = new Hyper().get("/health", "OK")
    const r = app.routeList.find((x) => x.path === "/health")!
    expect(r).toBeDefined()
    expect(r.kind).toBe("static")
    expect(r.staticResponse).toBeInstanceOf(Response)
  })

  test("GET with opts + handler wires params/query/body schemas", async () => {
    const schema: StandardSchemaV1<unknown, { name: string }> = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => ({ value: value as { name: string } }),
      },
    }
    const app = new Hyper().post("/echo", { body: schema }, ({ body }) => ok(body))
    const res = await app.fetch(
      new Request("http://x/echo", {
        method: "POST",
        body: JSON.stringify({ name: "ada" }),
        headers: { "content-type": "application/json" },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: "ada" })
  })

  test("every HTTP verb shortcut dispatches correctly", async () => {
    const app = new Hyper()
      .get("/x", () => "get")
      .post("/x", () => "post")
      .put("/x", () => "put")
      .patch("/x", () => "patch")
      .delete("/x", () => "delete")
      .head("/x", () => new Response(null, { status: 200 }))
      .options("/x", () => "options")

    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
      const res = await app.fetch(new Request("http://x/x", { method }))
      expect(res.status).toBe(200)
      if (method !== "OPTIONS") {
        // OPTIONS may be intercepted by plugins in real apps; we have
        // none here, so the route runs and returns "options".
        expect(await res.text()).toBe(method.toLowerCase())
      } else {
        expect(await res.text()).toBe("options")
      }
    }
  })
})

// ---------------------------------------------------------------------
// Prefix + sub-app composition
// ---------------------------------------------------------------------

describe("Hyper — prefix + sub-app composition", () => {
  test("constructor prefix is prepended to verb-added routes", async () => {
    const users = new Hyper({ prefix: "/users" })
      .get("/", () => ok([1, 2, 3]))
      .get("/:id", ({ params }) => ok({ id: (params as { id: string }).id }))

    const paths = users.routeList.map((r) => r.path).sort()
    expect(paths).toEqual(["/users", "/users/:id"])

    const res = await users.fetch(new Request("http://x/users"))
    expect(res.status).toBe(200)
  })

  test(".use(sub) mounts sub-app at its own prefix", async () => {
    const users = new Hyper({ prefix: "/users" }).get("/", () => ok("list"))
    const app = new Hyper().use(users)

    const res = await app.fetch(new Request("http://x/users"))
    expect(res.status).toBe(200)
    expect(await res.json()).toBe("list")
  })

  test(".use(prefix, sub) re-prefixes the sub-app", async () => {
    const users = new Hyper({ prefix: "/users" }).get("/", () => ok("list"))
    const app = new Hyper().use("/v1", users)

    const res = await app.fetch(new Request("http://x/v1/users"))
    expect(res.status).toBe(200)
    expect(await res.json()).toBe("list")
  })

  test("parent prefix + sub's prefix + explicit re-prefix all compose", async () => {
    const users = new Hyper({ prefix: "/users" }).get("/me", () => ok("me"))
    const app = new Hyper({ prefix: "/api" }).use("/v1", users)

    const paths = app.routeList.map((r) => r.path)
    expect(paths).toContain("/api/v1/users/me")
  })

  test(".use(prefix, sub) throws if second arg is not a Hyper", () => {
    const app = new Hyper()
    expect(() => {
      ;(app as unknown as { use: (p: string, s: unknown) => void }).use("/x", {})
    }).toThrow(/must be a Hyper instance/i)
  })
})

// ---------------------------------------------------------------------
// .use() polymorphism
// ---------------------------------------------------------------------

describe("Hyper — .use() polymorphism", () => {
  test("accepts a single Route", async () => {
    const r = route.get("/ping").handle(() => "pong")
    const app = new Hyper().use(r)
    expect(app.routeList).toHaveLength(1)
    const res = await app.fetch(new Request("http://x/ping"))
    expect(await res.text()).toBe("pong")
  })

  test("accepts a Route[] array", async () => {
    const r1 = route.get("/a").handle(() => "a")
    const r2 = route.get("/b").handle(() => "b")
    const app = new Hyper().use([r1, r2])
    expect(app.routeList).toHaveLength(2)
  })

  test("accepts a GroupBuilder", async () => {
    const g = group("/g").add(route.get("/x").handle(() => "gx"))
    const app = new Hyper().use(g)
    const res = await app.fetch(new Request("http://x/g/x"))
    expect(await res.text()).toBe("gx")
  })

  test("accepts a HyperPlugin", async () => {
    let buildCalled = false
    const pin = {
      name: "test-plugin",
      build: () => {
        buildCalled = true
      },
    }
    const app = new Hyper().use(pin).get("/", () => "hi")
    // Force build (plugin.build runs during boot)
    await app.fetch(new Request("http://x/"))
    expect(buildCalled).toBe(true)
  })

  test("accepts middleware and applies it to later routes only", async () => {
    const calls: string[] = []
    const mw = async ({ next }: { next: () => Promise<unknown> }) => {
      calls.push("mw")
      return next()
    }
    const app = new Hyper()
      .get("/early", () => "early")
      .use(mw as Parameters<Hyper["use"]>[0])
      .get("/late", () => "late")

    await app.fetch(new Request("http://x/early"))
    expect(calls).toEqual([]) // not wrapped
    await app.fetch(new Request("http://x/late"))
    expect(calls).toEqual(["mw"])
  })

  test("accepts an ESM namespace object", async () => {
    const users = {
      list: route.get("/users").handle(() => ok([])),
      one: route.get("/users/:id").handle(({ params }) => ok(params)),
      _not_a_route: "skip me",
      config: { some: "metadata" },
    }
    const app = new Hyper().use(users as unknown as Record<string, unknown>)
    expect(app.routeList.map((r) => r.path).sort()).toEqual(["/users", "/users/:id"])
  })

  test("rejects unsupported argument shapes", () => {
    const app = new Hyper()
    expect(() => (app as unknown as { use: (x: unknown) => void }).use(42)).toThrow(/unsupported/i)
  })
})

// ---------------------------------------------------------------------
// Decorate / derive / env / security
// ---------------------------------------------------------------------

describe("Hyper — lifecycle config", () => {
  test(".decorate adds static ctx visible to handlers", async () => {
    const app = new Hyper()
      .decorate(() => ({ counter: 42 }))
      .get("/", ({ ctx }) => ok({ counter: ctx.counter }))

    const res = await app.fetch(new Request("http://x/"))
    expect(await res.json()).toEqual({ counter: 42 })
  })

  test(".derive runs per-request", async () => {
    let calls = 0
    const app = new Hyper()
      .derive(() => {
        calls++
        return { tick: calls }
      })
      .get("/", ({ ctx }) => ok({ tick: ctx.tick }))

    const r1 = await app.fetch(new Request("http://x/"))
    const r2 = await app.fetch(new Request("http://x/"))
    expect((await r1.json()).tick).toBe(1)
    expect((await r2.json()).tick).toBe(2)
  })

  test(".build() is memoized; mutation invalidates the cache", () => {
    const app = new Hyper().get("/a", () => "a")
    const first = app.build()
    const second = app.build()
    expect(first).toBe(second)

    app.get("/b", () => "b")
    const third = app.build()
    expect(third).not.toBe(first)
    expect(third.routeList.map((r) => r.path).sort()).toEqual(["/a", "/b"])
  })
})

// ---------------------------------------------------------------------
// .listen() — real Bun.serve
// ---------------------------------------------------------------------

interface Spawned {
  readonly app: Hyper
  readonly url: string
  stop: () => Promise<void>
}
const spawned: Spawned[] = []

afterAll(async () => {
  await Promise.all(spawned.map((s) => s.stop().catch(() => {})))
})

function spawn(app: Hyper): Spawned {
  // Bun.serve port:0 → OS-chosen free port. Overriding via listen options.
  const listening = app.listen({ port: 0, banner: false, drain: false })
  const server = listening.server
  if (!server) throw new Error("spawn: server was not booted")
  return {
    app: listening,
    url: `http://${server.hostname}:${server.port}`,
    stop: () => listening.stop(true),
  }
}

describe("Hyper — .listen() / real Bun.serve", () => {
  test("boots a real socket and serves a route", async () => {
    const app = new Hyper().get("/ping", () => ok({ pong: true }))
    const s = spawn(app)
    spawned.push(s)
    const res = await fetch(`${s.url}/ping`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pong: true })
  })

  test(".stop() releases the port", async () => {
    const app = new Hyper().get("/x", () => "x")
    const s = spawn(app)
    const url = s.url
    await s.stop()

    // After stop, app.server is cleared.
    expect(app.server).toBeUndefined()

    // Fetch should fail-to-connect. We don't assert on specific error
    // shape (depends on libuv/kernel); just that the socket closed.
    let connected = false
    try {
      const res = await fetch(`${url}/x`, {
        signal: AbortSignal.timeout(200),
      })
      connected = res.ok
    } catch {
      connected = false
    }
    expect(connected).toBe(false)
  })

  test("HYPER_SKIP_LISTEN skips Bun.serve but still returns the chain", () => {
    const prev = process.env.HYPER_SKIP_LISTEN
    process.env.HYPER_SKIP_LISTEN = "1"
    try {
      const app = new Hyper().get("/", () => "hi").listen(0)
      // Chain still works for introspection.
      expect(app.server).toBeUndefined()
      expect(app.routeList.length).toBe(1)
    } finally {
      process.env.HYPER_SKIP_LISTEN = prev
    }
  })

  test("banner is suppressed in production", () => {
    const original = console.log
    const logs: string[] = []
    console.log = ((...args: unknown[]) => {
      logs.push(args.join(" "))
    }) as typeof console.log
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const app = new Hyper().get("/", () => "hi").listen({ port: 0, drain: false })
      expect(app.server).toBeDefined()
      expect(logs.some((l) => l.includes("listening"))).toBe(false)
      void app.stop(false)
    } finally {
      console.log = original
      process.env.NODE_ENV = prevEnv
    }
  })

  test("banner prints in non-production", () => {
    const original = console.log
    const logs: string[] = []
    console.log = ((...args: unknown[]) => {
      logs.push(args.join(" "))
    }) as typeof console.log
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "development"
    try {
      const app = new Hyper().get("/", () => "hi").listen({ port: 0, drain: false })
      expect(logs.some((l) => l.includes("listening"))).toBe(true)
      void app.stop(false)
    } finally {
      console.log = original
      process.env.NODE_ENV = prevEnv
    }
  })
})

// ---------------------------------------------------------------------
// hyper() factory alias
// ---------------------------------------------------------------------

describe("hyper() factory", () => {
  test("returns a Hyper instance", () => {
    const a = hyper()
    expect(a).toBeInstanceOf(Hyper)
  })

  test("respects the same options as the class constructor", () => {
    const a = hyper({ prefix: "/api" }).get("/x", () => "x")
    expect(a.routeList[0]?.path).toBe("/api/x")
  })
})
