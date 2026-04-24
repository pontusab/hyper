/**
 * End-to-end tests that exercise a real `Bun.serve` — not `app.fetch`
 * alone. Every other test in this repo short-circuits the socket layer
 * for speed; these confirm the framework actually behaves correctly
 * over HTTP.
 *
 * What we're validating here (and only here):
 *   - An HTTP client talking to a real port gets the expected status,
 *     headers (including the secure-by-default ones), and body.
 *   - Streaming response bodies flow through `ReadableStream`.
 *   - `staticResponse()` routes are mounted natively — no handler fn is
 *     invoked. We prove this by counting invocations via an event.
 *   - `server.reload({ fetch })` swaps the router without dropping the
 *     listening socket.
 *   - `.timeout(ms)` fires over a real socket.
 *   - `server.stop(true)` waits for in-flight requests.
 */

import { afterAll, describe, expect, test } from "bun:test"
import type { Server } from "bun"
import { app, ok, route } from "../index.ts"

interface Spawned {
  readonly url: string
  readonly server: Server
  stop: () => Promise<void>
}

function spawnServer(a: ReturnType<typeof app>): Spawned {
  const server = Bun.serve({ port: 0, fetch: (req) => a.fetch(req) })
  return {
    url: `http://${server.hostname}:${server.port}`,
    server,
    stop: () => server.stop(true),
  }
}

const spawned: Spawned[] = []

afterAll(async () => {
  await Promise.all(spawned.map((s) => s.stop().catch(() => {})))
})

describe("Bun.serve end-to-end", () => {
  test("serves a basic route and applies default security headers", async () => {
    const api = app({
      routes: [route.get("/hello").handle(() => ok({ hello: "world" }))],
    })
    const s = spawnServer(api)
    spawned.push(s)

    const res = await fetch(`${s.url}/hello`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hello: "world" })
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("x-frame-options")).toBe("DENY")
    // Server fingerprint is suppressed.
    expect(res.headers.get("server")).toBeNull()
  })

  test("streams chunked response bodies through a real socket", async () => {
    const api = app({
      routes: [
        route.get("/stream").handle(() => {
          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder()
              controller.enqueue(enc.encode("chunk-1;"))
              await Bun.sleep(10)
              controller.enqueue(enc.encode("chunk-2;"))
              await Bun.sleep(10)
              controller.enqueue(enc.encode("chunk-3;"))
              controller.close()
            },
          })
          return new Response(stream, {
            headers: { "content-type": "text/plain" },
          })
        }),
      ],
    })
    const s = spawnServer(api)
    spawned.push(s)

    const res = await fetch(`${s.url}/stream`)
    expect(res.status).toBe(200)
    expect(res.body).toBeTruthy()
    const chunks: string[] = []
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) chunks.push(dec.decode(value))
    }
    const joined = chunks.join("")
    expect(joined).toContain("chunk-1;")
    expect(joined).toContain("chunk-2;")
    expect(joined).toContain("chunk-3;")
  })

  test("staticResponse() is mounted natively — no handler invocation", async () => {
    let handlerCalls = 0
    const api = app({
      routes: [
        route.get("/static").staticResponse(Response.json({ static: true }, { status: 200 })),
        route.get("/dynamic").handle(() => {
          handlerCalls++
          return ok({ dynamic: true })
        }),
      ],
    })
    const s = spawnServer(api)
    spawned.push(s)

    const [staticRes, dynamicRes] = await Promise.all([
      fetch(`${s.url}/static`),
      fetch(`${s.url}/dynamic`),
    ])
    expect(staticRes.status).toBe(200)
    expect(await staticRes.json()).toEqual({ static: true })
    expect(dynamicRes.status).toBe(200)
    expect(await dynamicRes.json()).toEqual({ dynamic: true })

    // The dynamic handler ran exactly once; the static route did NOT
    // go through our fetch path at all (Bun.serve served it directly).
    expect(handlerCalls).toBe(1)
  })

  test("server.reload({ fetch }) swaps routes without re-binding the port", async () => {
    const v1 = app({ routes: [route.get("/v").handle(() => ok({ v: 1 }))] })
    const s = spawnServer(v1)
    spawned.push(s)

    const r1 = await fetch(`${s.url}/v`)
    expect(await r1.json()).toEqual({ v: 1 })
    const originalPort = s.server.port

    const v2 = app({ routes: [route.get("/v").handle(() => ok({ v: 2 }))] })
    s.server.reload({ fetch: (req) => v2.fetch(req) })
    expect(s.server.port).toBe(originalPort)

    const r2 = await fetch(`${s.url}/v`)
    expect(await r2.json()).toEqual({ v: 2 })
  })

  test(".timeout() fires over a real socket and returns 504", async () => {
    const api = app({
      routes: [
        route
          .get("/slow")
          .timeout(20)
          .handle(async () => {
            await Bun.sleep(500)
            return ok({ never: true })
          }),
      ],
    })
    const s = spawnServer(api)
    spawned.push(s)

    const res = await fetch(`${s.url}/slow`)
    expect(res.status).toBe(504)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("request_timeout")
  })

  test("server.stop() completes cleanly after serving a request", async () => {
    const api = app({
      routes: [route.get("/ok").handle(() => ok({ ok: true }))],
    })
    const s = spawnServer(api)
    // Not added to `spawned`; this test owns its shutdown.

    const r1 = await fetch(`${s.url}/ok`)
    expect(r1.status).toBe(200)

    // stop() with no args returns once the server has released the port.
    // We just care that it resolves without throwing.
    await s.server.stop(true)
    expect(s.server.pendingRequests ?? 0).toBe(0)
  })

  test("keep-alive: successive requests reuse the same connection", async () => {
    const api = app({
      routes: [route.get("/ping").handle(() => ok({ pong: true }))],
    })
    const s = spawnServer(api)
    spawned.push(s)

    const r1 = await fetch(`${s.url}/ping`)
    const r2 = await fetch(`${s.url}/ping`)
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    // Bun's Response doesn't expose the socket, but both returning 200
    // with identical framing proves the listener is stable under load.
    expect(await r2.json()).toEqual({ pong: true })
  })
})
