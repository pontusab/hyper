import { describe, expect, test } from "bun:test"
import { sqliteRateLimit } from "../sqlite.ts"

describe("@usehyper/rate-limit/sqlite", () => {
  test("counts hits and blocks after limit", async () => {
    const s = sqliteRateLimit({ path: ":memory:" })
    const r1 = await s.take("ip:1", 2, 60_000)
    expect(r1.allowed).toBe(true)
    const r2 = await s.take("ip:1", 2, 60_000)
    expect(r2.allowed).toBe(true)
    const r3 = await s.take("ip:1", 2, 60_000)
    expect(r3.allowed).toBe(false)
    s.close()
  })

  test("independent keys are independent", async () => {
    const s = sqliteRateLimit({ path: ":memory:" })
    await s.take("ip:1", 1, 60_000)
    const other = await s.take("ip:2", 1, 60_000)
    expect(other.allowed).toBe(true)
    s.close()
  })
})
