import { describe, expect, test } from "bun:test"
import { app, route } from "@usehyper/core"
import { idempotency } from "../index.ts"

describe("@usehyper/idempotency", () => {
  let calls = 0
  const r = route
    .post("/pay")
    .use(idempotency({ ttlMs: 60_000 }))
    .handle(async () => {
      calls += 1
      return new Response(JSON.stringify({ id: calls }), {
        headers: { "content-type": "application/json" },
      })
    })
  const a = app({ routes: [r] })

  test("replays the same response for the same key", async () => {
    calls = 0
    const req = () =>
      new Request("http://local/pay", {
        method: "POST",
        headers: { "idempotency-key": "abc", "content-type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      })
    const r1 = await a.fetch(req())
    const r2 = await a.fetch(req())
    const b1 = (await r1.json()) as { id: number }
    const b2 = (await r2.json()) as { id: number }
    expect(b1.id).toBe(1)
    expect(b2.id).toBe(1)
    expect(calls).toBe(1)
    expect(r2.headers.get("idempotent-replayed")).toBe("true")
  })

  test("different key -> fresh response", async () => {
    calls = 0
    const r1 = await a.fetch(
      new Request("http://local/pay", {
        method: "POST",
        headers: { "idempotency-key": "a" },
        body: "{}",
      }),
    )
    const r2 = await a.fetch(
      new Request("http://local/pay", {
        method: "POST",
        headers: { "idempotency-key": "b" },
        body: "{}",
      }),
    )
    expect(((await r1.json()) as { id: number }).id).toBe(1)
    expect(((await r2.json()) as { id: number }).id).toBe(2)
  })
})
