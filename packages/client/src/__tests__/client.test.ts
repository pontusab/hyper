import { describe, expect, test } from "bun:test"
import { app, created, ok, route } from "@hyper/core"
import { applyPathParams, createClient } from "../client.ts"
import { generateClient } from "../codegen.ts"
import type { Transport } from "../types.ts"

function appAsTransport(a: ReturnType<typeof app>, baseUrl = "http://local"): Transport {
  return {
    async request({ method, url, body, headers }) {
      const full = url.startsWith("http") ? url : `${baseUrl}${url}`
      const req = new Request(full, {
        method,
        ...(body !== undefined && {
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
        headers: {
          "content-type": "application/json",
          ...headers,
        },
      })
      const res = await a.fetch(req)
      const ct = res.headers.get("content-type") ?? ""
      const data = ct.includes("application/json") ? await res.json() : await res.text()
      return { status: res.status, data, headers: res.headers }
    },
  }
}

describe("client", () => {
  test("applyPathParams fills :param", () => {
    expect(applyPathParams("/users/:id", { id: "42" })).toBe("/users/42")
    expect(applyPathParams("/users/:id/:k", { id: "a", k: "b" })).toBe("/users/a/b")
    expect(() => applyPathParams("/:missing", {})).toThrow()
  })

  test("createClient.call round-trips against an in-process app", async () => {
    const a = app({
      routes: [
        route.get("/users/:id").handle(({ params }) => ok({ id: params.id })),
        route.post("/users").handle(() => created({ id: "u1" })),
      ],
    })
    const client = createClient(appAsTransport(a))
    const getUser = await client.call<{ id: string }>({
      method: "GET",
      path: "/users/:id",
      params: { id: "42" },
    })
    expect(getUser.id).toBe("42")

    const createUser = await client.call<{ id: string }>({
      method: "POST",
      path: "/users",
      body: { name: "x" },
    })
    expect(createUser.id).toBe("u1")
  })

  test("createClient throws structured error with code+message on 4xx/5xx", async () => {
    const a = app({
      routes: [route.get("/missing").handle(() => ok({ ok: true }))],
    })
    const client = createClient(appAsTransport(a))
    await expect(client.call({ method: "GET", path: "/does-not-exist" })).rejects.toThrow(
      /No route for/,
    )
  })
})

describe("codegen", () => {
  test("emits runtime + declaration from a client manifest", () => {
    const a = app({
      routes: [
        route
          .get("/users")
          .meta({ name: "users.list" })
          .handle(() => ok([])),
        route
          .post("/users")
          .meta({ name: "users.create" })
          .handle(() => created({ id: "u1" })),
        route
          .get("/users/:id")
          .meta({ name: "users.get" })
          .handle(() => ok({ id: "u1" })),
      ],
    })
    const out = generateClient({
      manifest: a.toClientManifest(),
      baseUrl: "http://localhost:3000",
      rootName: "api",
    })
    expect(out.runtime).toContain("createClient")
    expect(out.runtime).toContain("/users")
    expect(out.declaration).toContain("users: {")
    expect(out.declaration).toContain("list: Leaf")
    expect(out.declaration).toContain("create: Leaf")
    expect(out.declaration).toContain("get: Leaf")
  })

  test("resultTypes: true emits Result<T, Errors> tagged unions", () => {
    const stubSchema = {
      "~standard": { version: 1, vendor: "test", validate: (v: unknown) => ({ value: v }) },
    } as unknown as import("@hyper/core").StandardSchemaV1
    const a = app({
      routes: [
        route
          .get("/users/:id")
          .meta({ name: "users.get" })
          .throws({ 404: stubSchema })
          .errors({ email_exists: stubSchema })
          .handle(() => ok({ id: "u1" })),
      ],
    })
    const out = generateClient({
      manifest: a.toClientManifest(),
      baseUrl: "http://localhost:3000",
      rootName: "api",
      resultTypes: true,
    })
    expect(out.declaration).toContain("export type Result<T, C extends string>")
    expect(out.declaration).toContain("ok: true")
    expect(out.declaration).toContain('"http_404"')
    expect(out.declaration).toContain('"email_exists"')
    expect(out.runtime).toContain("ok: false")
  })
})
