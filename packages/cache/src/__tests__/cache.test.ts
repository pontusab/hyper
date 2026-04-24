import { describe, expect, test } from "bun:test"
import { app, route } from "@usehyper/core"
import { cache } from "../index.ts"

describe("@usehyper/cache", () => {
  test("caches GET responses and serves 304 on matching etag", async () => {
    let calls = 0
    const r = route
      .get("/hi")
      .use(cache({ maxAge: 60 }))
      .handle(() => {
        calls += 1
        return new Response(JSON.stringify({ n: calls }), {
          headers: { "content-type": "application/json" },
        })
      })
    const a = app({ routes: [r] })
    const r1 = await a.fetch(new Request("http://local/hi"))
    expect(calls).toBe(1)
    const etag = r1.headers.get("etag")
    expect(etag).toBeTruthy()
    expect(r1.headers.get("x-cache")).toBe("miss")

    const r2 = await a.fetch(new Request("http://local/hi"))
    expect(calls).toBe(1)
    expect(r2.headers.get("x-cache")).toBe("fresh")

    const r3 = await a.fetch(
      new Request("http://local/hi", { headers: { "if-none-match": etag! } }),
    )
    expect(r3.status).toBe(304)
  })

  test("does not cache POST", async () => {
    let calls = 0
    const r = route
      .post("/w")
      .use(cache({ maxAge: 60 }))
      .handle(() => {
        calls += 1
        return new Response("ok")
      })
    const a = app({ routes: [r] })
    await a.fetch(new Request("http://local/w", { method: "POST" }))
    await a.fetch(new Request("http://local/w", { method: "POST" }))
    expect(calls).toBe(2)
  })
})
