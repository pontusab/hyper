import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import {
  MIN_JWT_SECRET_BYTES,
  authJwt,
  installAuthMethod,
  validateJwtSecret,
  verifyJwt,
} from "../index.ts"

const SECRET = "test-secret-that-is-exactly-32-b"

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" }
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  const body = `${enc(header)}.${enc(payload)}`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))
  let s = ""
  for (let i = 0; i < sig.length; i++) s += String.fromCharCode(sig[i]!)
  const b64 = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `${body}.${b64}`
}

describe("@hyper/auth-jwt", () => {
  const mw = authJwt({ secret: SECRET, algorithms: ["HS256"] })
  installAuthMethod(mw)
  const protectedRoute = route
    .get("/me")
    .use(mw)
    .handle((c) => ({ sub: (c.ctx.user as { sub: string }).sub }))
  const a = app({ routes: [protectedRoute] })

  test("accepts a valid HS256 token", async () => {
    const token = await signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 60 })
    const res = await a.fetch(
      new Request("http://local/me", { headers: { authorization: `Bearer ${token}` } }),
    )
    expect(res.status).toBe(200)
    const j = (await res.json()) as { sub: string }
    expect(j.sub).toBe("user-1")
  })

  test("rejects missing token", async () => {
    const res = await a.fetch(new Request("http://local/me"))
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toContain("Bearer")
  })

  test("rejects expired token", async () => {
    const token = await signJwt({ sub: "u", exp: Math.floor(Date.now() / 1000) - 1000 })
    await expect(verifyJwt(token, { secret: SECRET })).rejects.toThrow(/expired/)
  })

  test("validateJwtSecret: short secret throws with a why/fix message", () => {
    expect(() => validateJwtSecret("short")).toThrow(/minimum is 32/)
  })

  test("authJwt({ secret: too_short }) refuses to install", () => {
    expect(() => authJwt({ secret: "short", algorithms: ["HS256"] })).toThrow(/minimum is 32/)
  })

  test("allowShortSecret: true permits short secrets (opt-in footgun)", () => {
    expect(() =>
      authJwt({ secret: "short", algorithms: ["HS256"], allowShortSecret: true }),
    ).not.toThrow()
  })

  test("MIN_JWT_SECRET_BYTES = 32", () => {
    expect(MIN_JWT_SECRET_BYTES).toBe(32)
  })
})
