import { describe, expect, test } from "bun:test"
import { sqliteSessions } from "../sqlite.ts"

describe("@usehyper/session/sqlite", () => {
  test("stores + retrieves + destroys data", async () => {
    const s = sqliteSessions({ path: ":memory:" })
    await s.set("sid1", { userId: "u1" }, 60_000)
    const v = await s.get("sid1")
    expect(v?.userId).toBe("u1")
    await s.destroy("sid1")
    expect(await s.get("sid1")).toBeUndefined()
    s.close()
  })

  test("expires entries past ttl", async () => {
    const s = sqliteSessions({ path: ":memory:" })
    await s.set("expired", { x: 1 }, -1)
    expect(await s.get("expired")).toBeUndefined()
    s.close()
  })
})
