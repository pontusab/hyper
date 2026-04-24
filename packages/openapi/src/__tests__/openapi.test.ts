import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { generate, openapiHandlers } from "../index.ts"

describe("@hyper/openapi", () => {
  const bodySchema = {
    "~standard": {
      version: 1 as const,
      vendor: "t",
      validate: (v: unknown) => ({ value: v as { name: string } }),
    },
  }
  const errSchema = {
    "~standard": {
      version: 1 as const,
      vendor: "t",
      validate: (v: unknown) => ({ value: v }),
    },
  }

  const hello = route
    .get("/hello/:name")
    .meta({ name: "hello", tags: ["greet"] })
    .handle(() => "hi")
  const create = route
    .post("/things")
    .body(bodySchema as never)
    .throws({ 404: errSchema as never })
    .example({
      name: "ada",
      input: { body: { name: "ada" } },
      output: { status: 201, body: { id: 1 } },
    })
    .version("v2")
    .handle(() => ({ id: 1 }))
  const gone = route
    .get("/gone")
    .deprecated({ sunset: "2026-12-31" })
    .handle(() => "bye")
  const internal = route
    .get("/__internal")
    .meta({ internal: true })
    .handle(() => "x")

  const a = app({ routes: [hello, create, gone, internal] })

  test("generates 3.1 doc with operationId, params, deprecated", () => {
    const doc = generate(a, { title: "T", version: "1.0.0" })
    expect(doc.openapi).toBe("3.1.0")
    expect(doc.info.title).toBe("T")
    expect(doc.paths["/hello/{name}"]?.get?.operationId).toBe("hello")
    expect(doc.paths["/hello/{name}"]?.get?.parameters?.[0]?.name).toBe("name")
    expect(doc.paths["/gone"]?.get?.deprecated).toBe(true)
    expect(doc.paths["/gone"]?.get?.["x-sunset"]).toBe("2026-12-31")
  })

  test("skips internal routes", () => {
    const doc = generate(a)
    expect(doc.paths["/__internal"]).toBeUndefined()
  })

  test("projects .throws() into responses and version into x-version", () => {
    const doc = generate(a)
    expect(doc.paths["/things"]?.post?.responses["404"]).toBeDefined()
    expect(doc.paths["/things"]?.post?.["x-version"]).toBe("v2")
    // body examples
    expect(
      doc.paths["/things"]?.post?.requestBody?.content["application/json"]?.examples?.ada,
    ).toEqual({ value: { name: "ada" } })
  })

  test("openapiHandlers returns json spec + html docs", async () => {
    const { spec, docs } = openapiHandlers(a, { title: "T" })
    const r1 = spec(new Request("http://local/openapi.json"))
    expect(r1.headers.get("content-type")).toContain("application/json")
    const j = (await r1.json()) as { openapi: string }
    expect(j.openapi).toBe("3.1.0")
    const r2 = docs(new Request("http://local/docs"))
    expect(r2.headers.get("content-type")).toContain("text/html")
    const html = await r2.text()
    expect(html).toContain("swagger-ui")
  })
})
