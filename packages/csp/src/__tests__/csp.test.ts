import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { cspPlugin } from "../index.ts"

describe("@hyper/csp", () => {
  test("emits strict default-src 'none' CSP for JSON APIs", async () => {
    const a = app({
      routes: [route.get("/").handle(() => ({ ok: true }))],
      plugins: [cspPlugin()],
    })
    const res = await a.fetch(new Request("http://local/"))
    const csp = res.headers.get("content-security-policy")!
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("upgrade-insecure-requests")
  })

  test("reportOnly flag switches header name", async () => {
    const a = app({
      routes: [route.get("/").handle(() => ({ ok: true }))],
      plugins: [cspPlugin({ reportOnly: true })],
    })
    const res = await a.fetch(new Request("http://local/"))
    expect(res.headers.get("content-security-policy")).toBeNull()
    expect(res.headers.get("content-security-policy-report-only")).toContain("default-src")
  })

  test("nonce: adds 'nonce-…' to script-src per response", async () => {
    const a = app({
      routes: [route.get("/").handle(({ ctx }) => ({ nonce: ctx.cspNonce }))],
      plugins: [cspPlugin({ nonce: true, directives: { "script-src": ["'self'"] } })],
    })
    const r1 = await a.fetch(new Request("http://local/"))
    const r2 = await a.fetch(new Request("http://local/"))
    const n1 = (await r1.json()) as { nonce: string }
    const n2 = (await r2.json()) as { nonce: string }
    expect(n1.nonce).toBeTruthy()
    expect(n2.nonce).toBeTruthy()
    expect(n1.nonce).not.toBe(n2.nonce)
    expect(r1.headers.get("content-security-policy")).toContain(`'nonce-${n1.nonce}'`)
  })

  test("reportUri adds report-uri + Report-To", async () => {
    const a = app({
      routes: [route.get("/").handle(() => "ok")],
      plugins: [cspPlugin({ reportUri: "https://reports.example.com/csp" })],
    })
    const res = await a.fetch(new Request("http://local/"))
    expect(res.headers.get("content-security-policy")).toContain(
      "report-uri https://reports.example.com/csp",
    )
    expect(res.headers.get("report-to")).toContain('"group":"csp"')
  })
})
