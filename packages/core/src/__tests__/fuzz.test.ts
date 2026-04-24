/**
 * Request-boundary fuzz corpus — runs against a small app to prove the
 * secure-by-default baseline refuses every known-bad shape.
 *
 * This corpus is the single source of truth referenced by
 * @usehyper/testing/fuzz; keeping it here lets core tests run it directly.
 */

import { describe, expect, test } from "bun:test"
import { app, route } from "../index.ts"

function buildApp() {
  return app({
    routes: [
      route.get("/").handle(() => "ok"),
      route.post("/echo").handle(({ body }) => ({ body })),
    ],
  })
}

describe("fuzz corpus — request boundary", () => {
  test("proto pollution payloads", async () => {
    const a = buildApp()
    const payloads = [
      '{"__proto__":{"polluted":true}}',
      '{"constructor":{"prototype":{"x":1}}}',
      '{"nested":{"__proto__":{"x":1}}}',
      '{"arr":[{"__proto__":{"x":1}}]}',
    ]
    for (const p of payloads) {
      const res = await a.fetch(
        new Request("http://localhost/echo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: p,
        }),
      )
      expect(res.status).toBe(400)
    }
  })

  test("oversized bodies rejected with 413", async () => {
    const a = buildApp()
    const big = `{"x":"${"a".repeat(2_000_000)}"}`
    const res = await a.fetch(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: big,
      }),
    )
    expect(res.status).toBe(413)
  })

  test("malformed JSON rejected with 400 and why/fix", async () => {
    const a = buildApp()
    const res = await a.fetch(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    )
    expect(res.status).toBe(400)
    const payload = (await res.json()) as { error: { code?: string; why?: string; fix?: string } }
    expect(payload.error.code).toBe("invalid_json")
    expect(payload.error.why).toBeTruthy()
    expect(payload.error.fix).toBeTruthy()
  })

  test("X-HTTP-Method-Override is rejected (CSRF/verb smuggling guard)", async () => {
    const a = buildApp()
    const res = await a.fetch(
      new Request("http://localhost/", {
        method: "GET",
        headers: { "x-http-method-override": "POST" },
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("method_override_rejected")
  })

  test("no Server: header leaked in any response", async () => {
    const a = buildApp()
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.headers.get("server")).toBeNull()
  })
})
