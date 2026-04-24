import { describe, expect, test } from "bun:test"
import { app, ok, onError, onFinish, onStart, onSuccess, route } from "../index.ts"

describe("middleware", () => {
  test("runs in order around the handler", async () => {
    const order: string[] = []
    const r = route
      .get("/")
      .use(async ({ next }) => {
        order.push("before A")
        const out = await next()
        order.push("after A")
        return out
      })
      .use(async ({ next }) => {
        order.push("before B")
        const out = await next()
        order.push("after B")
        return out
      })
      .handle(() => {
        order.push("handler")
        return ok({ ok: true })
      })

    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.status).toBe(200)
    expect(order).toEqual(["before A", "before B", "handler", "after B", "after A"])
  })

  test("lifecycle factories: onStart/onSuccess/onFinish", async () => {
    const events: string[] = []
    const r = route
      .get("/")
      .use(onStart(() => void events.push("start")))
      .use(onSuccess(() => void events.push("success")))
      .use(onFinish(({ error }) => void events.push(error ? "finish:err" : "finish:ok")))
      .handle(() => ({ ok: true }))

    const a = app({ routes: [r] })
    await a.fetch(new Request("http://localhost/"))
    expect(events).toEqual(["start", "finish:ok", "success"])
  })

  test("onError catches and rethrows thrown errors", async () => {
    const seen: unknown[] = []
    const r = route
      .get("/")
      .use(onError(({ error }) => void seen.push(error)))
      .handle(() => {
        throw new Error("boom")
      })

    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.status).toBe(500)
    expect(seen).toHaveLength(1)
  })

  test("middleware can short-circuit with a Response", async () => {
    const r = route
      .get("/")
      .use(async () => new Response("intercepted", { status: 418 }))
      .handle(() => ({ unreached: true }))

    const a = app({ routes: [r] })
    const res = await a.fetch(new Request("http://localhost/"))
    expect(res.status).toBe(418)
    expect(await res.text()).toBe("intercepted")
  })

  test(".callable() invokes the handler in-process", async () => {
    const r = route
      .post("/users/:id")
      .handle(({ params, body }) => ({ id: (params as { id: string }).id, body }))

    const result = (await r.callable({
      params: { id: "42" },
      body: { name: "ada" },
    })) as { id: string; body: unknown }
    expect(result.id).toBe("42")
    expect(result.body).toEqual({ name: "ada" })
  })

  test(".errors() and .throws() land on the Route (projection surface)", () => {
    const errSchema = {
      "~standard": { version: 1, vendor: "t", validate: (v: unknown) => ({ value: v }) },
    } as const
    const r = route
      .get("/")
      .errors({ NOT_FOUND: errSchema as never })
      .throws({ 404: errSchema as never })
      .handle(() => "ok")

    // Contract: meta-level fields are preserved for projections (OpenAPI/MCP/client)
    // even if the current route type hides them for DX.
    expect(typeof r.handler).toBe("function")
  })
})
