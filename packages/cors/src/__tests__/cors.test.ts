import { describe, expect, test } from "bun:test"
import { app, route } from "@usehyper/core"
import { corsPlugin } from "../index.ts"

describe("@usehyper/cors", () => {
  const r = route.get("/").handle(() => "ok")
  const a = app({
    routes: [r],
    plugins: [corsPlugin({ origin: ["https://example.com"], credentials: true })],
  })

  test("responds to preflight with allowed origin", async () => {
    const res = await a.fetch(
      new Request("http://local/", {
        method: "OPTIONS",
        headers: {
          origin: "https://example.com",
          "access-control-request-method": "GET",
        },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com")
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
  })

  test("rejects disallowed origin silently (no ACAO header)", async () => {
    const res = await a.fetch(
      new Request("http://local/", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.com",
          "access-control-request-method": "GET",
        },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("throws on wildcard+credentials combo (even with allowAnyOrigin)", () => {
    expect(() => corsPlugin({ origin: "*", credentials: true, allowAnyOrigin: true })).toThrow(
      /credentials/,
    )
  })

  test("throws on bare wildcard origin without allowAnyOrigin opt-in", () => {
    expect(() => corsPlugin({ origin: "*" })).toThrow(/refused by default/)
  })

  test("allowAnyOrigin: true permits wildcard explicitly (opt-in footgun)", () => {
    expect(() => corsPlugin({ origin: "*", allowAnyOrigin: true })).not.toThrow()
  })

  test("simple GET gets ACAO header when origin allowed", async () => {
    const res = await a.fetch(
      new Request("http://local/", { headers: { origin: "https://example.com" } }),
    )
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com")
  })
})
