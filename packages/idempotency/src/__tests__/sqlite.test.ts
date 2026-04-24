import { describe, expect, test } from "bun:test"
import { sqliteIdempotency } from "../sqlite.ts"

describe("@usehyper/idempotency/sqlite", () => {
  test("stores responses with TTL expiry", async () => {
    const s = sqliteIdempotency({ path: ":memory:" })
    await s.set(
      "k",
      { status: 201, headers: { a: "b" }, body: '{"ok":true}', createdAt: Date.now() },
      60_000,
    )
    const v = await s.get("k")
    expect(v?.status).toBe(201)
    expect(v?.headers.a).toBe("b")
    expect(v?.body).toBe('{"ok":true}')
    s.close()
  })

  test("lock() is single-flight within the TTL window", async () => {
    const s = sqliteIdempotency({ path: ":memory:" })
    expect(await s.lock("x", 1_000)).toBe(true)
    expect(await s.lock("x", 1_000)).toBe(false)
    await s.unlock("x")
    expect(await s.lock("x", 1_000)).toBe(true)
    s.close()
  })
})
