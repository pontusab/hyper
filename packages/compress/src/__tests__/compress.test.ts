import { describe, expect, test } from "bun:test"
import { brotliDecompressSync, gunzipSync } from "node:zlib"
import { app, route } from "@usehyper/core"
import { compress } from "../index.ts"

const BIG = "x".repeat(4096)

describe("@usehyper/compress", () => {
  test("gzips large text responses when accept-encoding allows", async () => {
    const a = app({
      routes: [
        route
          .get("/t")
          .use(compress({ brotli: false }))
          .handle(() => new Response(BIG, { headers: { "content-type": "text/plain" } })),
      ],
    })
    const res = await a.fetch(
      new Request("http://local/t", { headers: { "accept-encoding": "gzip" } }),
    )
    expect(res.headers.get("content-encoding")).toBe("gzip")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(gunzipSync(body))).toBe(BIG)
  })

  test("prefers brotli when client advertises it", async () => {
    const a = app({
      routes: [
        route
          .get("/t")
          .use(compress())
          .handle(() => new Response(BIG, { headers: { "content-type": "text/html" } })),
      ],
    })
    const res = await a.fetch(
      new Request("http://local/t", { headers: { "accept-encoding": "gzip, br" } }),
    )
    expect(res.headers.get("content-encoding")).toBe("br")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(brotliDecompressSync(body))).toBe(BIG)
  })

  test("skips binary content types", async () => {
    const a = app({
      routes: [
        route
          .get("/bin")
          .use(compress())
          .handle(
            () => new Response(new Uint8Array(4096), { headers: { "content-type": "image/png" } }),
          ),
      ],
    })
    const res = await a.fetch(
      new Request("http://local/bin", { headers: { "accept-encoding": "gzip" } }),
    )
    expect(res.headers.get("content-encoding")).toBeNull()
  })

  test("skips responses below threshold but still sets Vary", async () => {
    const a = app({
      routes: [
        route
          .get("/s")
          .use(compress({ threshold: 10_000 }))
          .handle(() => new Response("hi", { headers: { "content-type": "text/plain" } })),
      ],
    })
    const res = await a.fetch(
      new Request("http://local/s", { headers: { "accept-encoding": "gzip" } }),
    )
    expect(res.headers.get("content-encoding")).toBeNull()
    expect(res.headers.get("vary")).toContain("Accept-Encoding")
  })
})
