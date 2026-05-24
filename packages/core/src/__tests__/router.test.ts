/**
 * Router-level tests for intra-segment param patterns.
 *
 * Pure-segment `:id` is exercised heavily by route.test.ts; here we focus on
 * mixed segments (`:slug.json`, `:a@:b.json`, `v:version`, `:y-:m-:d`),
 * precedence (static > mixed > wildcard), and decoding.
 */

import { describe, expect, test } from "bun:test"
import { Router } from "../router.ts"
import type { Route } from "../types.ts"

function fakeRoute(method: "GET" | "POST", path: string, id: string): Route {
  return { method, path, id } as unknown as Route
}

describe("router: intra-segment params", () => {
  test("suffix-only pattern: /r/:slug.json", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:slug.json", "manifest"))
    const m = r.find("GET", "/r/cors.json")
    expect(m?.route.id).toBe("manifest")
    expect(m?.params).toEqual({ slug: "cors" })
    expect(r.find("GET", "/r/cors.txt")).toBeNull()
    expect(r.find("GET", "/r/cors")).toBeNull()
  })

  test("two params + literal between + extension: /r/:name@:version.json", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:name@:version.json", "versioned"))
    const m = r.find("GET", "/r/cors@0.1.0.json")
    expect(m?.route.id).toBe("versioned")
    expect(m?.params).toEqual({ name: "cors", version: "0.1.0" })
    expect(r.find("GET", "/r/cors.json")).toBeNull()
    expect(r.find("GET", "/r/cors@.json")).toBeNull()
  })

  test("prefix-only pattern: /v:version/users", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/v:version/users", "vu"))
    const m = r.find("GET", "/v1/users")
    expect(m?.route.id).toBe("vu")
    expect(m?.params).toEqual({ version: "1" })
  })

  test("multi-param with literal separators: /posts/:y-:m-:d", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/posts/:y-:m-:d", "date"))
    const m = r.find("GET", "/posts/2025-12-31")
    expect(m?.params).toEqual({ y: "2025", m: "12", d: "31" })
  })

  test("static beats mixed at the same depth", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/index.json", "idx"))
    r.add(fakeRoute("GET", "/r/:name.json", "manifest"))
    expect(r.find("GET", "/r/index.json")?.route.id).toBe("idx")
    expect(r.find("GET", "/r/cors.json")?.route.id).toBe("manifest")
    expect(r.find("GET", "/r/cors.json")?.params).toEqual({ name: "cors" })
  })

  test("mixed beats wildcard at the same depth", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/files/:name.txt", "txt"))
    r.add(fakeRoute("GET", "/files/*", "any"))
    expect(r.find("GET", "/files/foo.txt")?.route.id).toBe("txt")
    expect(r.find("GET", "/files/foo.txt")?.params).toEqual({ name: "foo" })
    expect(r.find("GET", "/files/foo.bin")?.route.id).toBe("any")
  })

  test("pure-segment params still preferred when path matches both", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/users/:id", "by-id"))
    expect(r.find("GET", "/users/42")?.params).toEqual({ id: "42" })
  })

  test("captures are URI-decoded", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:name.json", "m"))
    const m = r.find("GET", "/r/scope%20a.json")
    expect(m?.params).toEqual({ name: "scope a" })
  })

  test("regex meta in literals is escaped", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/x/:id.tar.gz", "tgz"))
    const m = r.find("GET", "/x/abc.tar.gz")
    expect(m?.params).toEqual({ id: "abc" })
    // Literal dots really are literal.
    expect(r.find("GET", "/x/abcXtarXgz")).toBeNull()
  })

  test("pure and mixed coexist at the same depth (mixed tried first)", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:name", "pure"))
    r.add(fakeRoute("GET", "/r/:slug.json", "mixed"))
    expect(r.find("GET", "/r/cors.json")?.route.id).toBe("mixed")
    expect(r.find("GET", "/r/cors.json")?.params).toEqual({ slug: "cors" })
    expect(r.find("GET", "/r/cors")?.route.id).toBe("pure")
    expect(r.find("GET", "/r/cors")?.params).toEqual({ name: "cors" })
  })

  test("two different mixed patterns at same depth coexist by specificity", () => {
    const r = new Router()
    // Register the less specific one first to prove order doesn't matter.
    r.add(fakeRoute("GET", "/r/:name.json", "latest"))
    r.add(fakeRoute("GET", "/r/:name@:version.json", "versioned"))
    expect(r.find("GET", "/r/cors@0.1.0.json")?.route.id).toBe("versioned")
    expect(r.find("GET", "/r/cors@0.1.0.json")?.params).toEqual({
      name: "cors",
      version: "0.1.0",
    })
    expect(r.find("GET", "/r/cors.json")?.route.id).toBe("latest")
    expect(r.find("GET", "/r/cors.json")?.params).toEqual({ name: "cors" })
  })

  test("registering the same mixed pattern twice with same method still throws (duplicate route)", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:slug.json", "a"))
    expect(() => r.add(fakeRoute("GET", "/r/:slug.json", "b"))).toThrow(/Duplicate/)
  })

  test("same mixed pattern with different methods is OK", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:slug.json", "g"))
    r.add(fakeRoute("POST", "/r/:slug.json", "p"))
    expect(r.find("GET", "/r/cors.json")?.route.id).toBe("g")
    expect(r.find("POST", "/r/cors.json")?.route.id).toBe("p")
  })

  test("duplicate param name within one segment is rejected", () => {
    const r = new Router()
    expect(() => r.add(fakeRoute("GET", "/x/:a-:a", "dup"))).toThrow(/Duplicate param/)
  })

  test("static-only fast path still produces no params object", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/health", "h"))
    const m = r.find("GET", "/health")
    expect(m?.route.id).toBe("h")
    // EMPTY_PARAMS is frozen and shared.
    expect(Object.keys(m?.params ?? {})).toHaveLength(0)
  })

  test("HEAD falls back to GET for mixed routes", () => {
    const r = new Router()
    r.add(fakeRoute("GET", "/r/:slug.json", "m"))
    expect(r.find("HEAD", "/r/cors.json")?.route.id).toBe("m")
  })
})
