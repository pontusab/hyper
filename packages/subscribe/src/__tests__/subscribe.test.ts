import { describe, expect, test } from "bun:test"
import { app } from "@usehyper/core"
import { collect, subscribe } from "../index.ts"

describe("@usehyper/subscribe", () => {
  test("projects to SSE over HTTP", async () => {
    const r = subscribe<{ n: number }>("/ticks", async function* () {
      yield { data: { n: 1 } }
      yield { data: { n: 2 }, event: "tick" }
    })
    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://local/ticks"))
    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream")
    const text = await res.text()
    expect(text).toContain('data: {"n":1}')
    expect(text).toContain("event: tick")
    expect(text).toContain('data: {"n":2}')
  })

  test("collect() materializes a bounded snapshot", async () => {
    const handler = async function* () {
      for (let i = 0; i < 10; i++) yield { data: i }
    }
    const items = await collect(handler, 3)
    expect(items.map((x) => x.data)).toEqual([0, 1, 2])
  })

  test("subscription metadata flag is set", () => {
    const r = subscribe<string>("/s", async function* () {
      yield { data: "hi" }
    })
    expect(r.meta.subscription).toBe(true)
  })
})
