import { describe, expect, test } from "bun:test"
import app from "../src/app.ts"

describe("apps/hello", () => {
  test("GET /health returns ok", async () => {
    const res = await app.fetch(new Request("http://localhost/health"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; at: string }
    expect(body.ok).toBe(true)
    expect(typeof body.at).toBe("string")
  })

  test("GET /hello/:name greets by name", async () => {
    const res = await app.fetch(new Request("http://localhost/hello/world"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "Hello, world!" })
  })

  test("default security headers present on every response", async () => {
    const res = await app.fetch(new Request("http://localhost/health"))
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("x-frame-options")).toBe("DENY")
    expect(res.headers.get("server")).toBeNull()
  })
})
