import { describe, expect, test } from "bun:test"
import { sqliteCache } from "../sqlite.ts"

describe("@usehyper/cache/sqlite", () => {
  test("roundtrips entries and persists headers/body/etag", async () => {
    const s = sqliteCache({ path: ":memory:", maxEntries: 10 })
    const body = new TextEncoder().encode("hello")
    await s.set("k1", {
      status: 200,
      headers: { "content-type": "text/plain" },
      body,
      etag: 'W/"abc"',
      createdAt: 1_000,
    })
    const got = await s.get("k1")
    expect(got?.status).toBe(200)
    expect(got?.headers["content-type"]).toBe("text/plain")
    expect(got?.etag).toBe('W/"abc"')
    expect(new TextDecoder().decode(got?.body)).toBe("hello")
    s.close()
  })

  test("evicts oldest when maxEntries exceeded", async () => {
    const s = sqliteCache({ path: ":memory:", maxEntries: 2 })
    const body = new Uint8Array([1])
    await s.set("a", { status: 200, headers: {}, body, etag: "a", createdAt: 1 })
    await s.set("b", { status: 200, headers: {}, body, etag: "b", createdAt: 2 })
    await s.set("c", { status: 200, headers: {}, body, etag: "c", createdAt: 3 })
    expect(await s.get("a")).toBeUndefined()
    expect(await s.get("b")).toBeDefined()
    expect(await s.get("c")).toBeDefined()
    s.close()
  })
})
