import { describe, expect, test } from "bun:test"
import { app, ok, route } from "@hyper/core"
import { hyperLog, memoryDrain } from "../index.ts"

describe("@hyper/log plugin", () => {
  test("emits one wide event per request with status + duration", async () => {
    const drain = memoryDrain()
    const r = route.get("/ping").handle(() => ok({ ok: true }))
    const a = app({
      routes: [r],
      plugins: [hyperLog({ drains: [drain], service: "test", clock: () => 1_700_000_000_000 })],
    })
    const res = await a.fetch(new Request("http://localhost/ping"))
    expect(res.status).toBe(200)
    expect(drain.events).toHaveLength(1)
    const event = drain.events[0]!
    expect(event.level).toBe("info")
    expect(event.msg).toBe("request")
    expect(event.status).toBe(200)
    expect(event.method).toBe("GET")
    expect(event.path).toBe("/ping")
    expect(event.service).toBe("test")
    expect(event.request_id).toEqual(expect.any(String))
  })

  test("redacts sensitive fields set on ctx.log", async () => {
    const drain = memoryDrain()
    const r = route.get("/login").handle((c) => {
      const log = (c.ctx as unknown as { log: { set: (f: object) => void } }).log
      log?.set({ user: { id: "u1", password: "hunter2", token: "t" } })
      return ok({ ok: true })
    })
    const a = app({ routes: [r], plugins: [hyperLog({ drains: [drain] })] })
    await a.fetch(new Request("http://localhost/login"))
    const event = drain.events[0] as unknown as {
      user: { id: string; password: string; token: string }
    }
    expect(event.user.password).toBe("[REDACTED]")
    expect(event.user.token).toBe("[REDACTED]")
    expect(event.user.id).toBe("u1")
  })

  test("on 500 the event is level=error with err.why/fix", async () => {
    const drain = memoryDrain()
    const r = route.get("/boom").handle(() => {
      throw Object.assign(new Error("boom"), { why: "test", fix: "do x" })
    })
    const a = app({ routes: [r], plugins: [hyperLog({ drains: [drain] })] })
    const res = await a.fetch(new Request("http://localhost/boom"))
    expect(res.status).toBe(500)
    expect(drain.events[0]!.level).toBe("error")
  })

  test("reuses x-request-id from inbound header", async () => {
    const drain = memoryDrain()
    const r = route.get("/").handle(() => ok({}))
    const a = app({ routes: [r], plugins: [hyperLog({ drains: [drain] })] })
    await a.fetch(new Request("http://localhost/", { headers: { "x-request-id": "req_abc" } }))
    expect(drain.events[0]!.request_id).toBe("req_abc")
  })
})
