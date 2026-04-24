import { beforeEach, describe, expect, test } from "bun:test"
import { Hyper, conflict, created, notFound, ok } from "@hyper/core"
import { hyperLog, memoryDrain } from "@hyper/log"
import { CreateTodo, TodoParams } from "../src/schemas.ts"
import { memoryStore } from "../src/store.ts"

function buildApp() {
  const drain = memoryDrain()
  const app = new Hyper()
    .decorate(() => ({ store: memoryStore() }))
    .use(hyperLog({ drains: [drain], service: "todo-example" }))
    .get("/health", () => ok({ ok: true }))
    .get("/todos", async ({ ctx }) => ok(await ctx.store.list()))
    .post("/todos", { body: CreateTodo }, async ({ ctx, body }) =>
      created(await ctx.store.create({ title: body.title })),
    )
    .patch("/todos/:id", { params: TodoParams }, async ({ ctx, params }) => {
      const updated = await ctx.store.toggle(params.id)
      return updated ? ok(updated) : notFound({ code: "not_found" })
    })
    .delete("/todos/:id", { params: TodoParams }, async ({ ctx, params }) => {
      const removed = await ctx.store.remove(params.id)
      return removed ? ok({ removed: params.id }) : conflict({ code: "conflict" })
    })
  return { app, drain }
}

describe("todo example", () => {
  let a: ReturnType<typeof buildApp>["app"]
  let drain: ReturnType<typeof memoryDrain>
  beforeEach(() => {
    const built = buildApp()
    a = built.app
    drain = built.drain
  })

  test("health", async () => {
    const res = await a.fetch(new Request("http://localhost/health"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("full CRUD flow", async () => {
    let res = await a.fetch(new Request("http://localhost/todos"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])

    res = await a.fetch(
      new Request("http://localhost/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "buy milk" }),
      }),
    )
    expect(res.status).toBe(201)
    const createdTodo = (await res.json()) as { id: string; title: string; done: boolean }
    expect(createdTodo.title).toBe("buy milk")
    expect(createdTodo.done).toBe(false)

    res = await a.fetch(
      new Request(`http://localhost/todos/${createdTodo.id}`, { method: "PATCH" }),
    )
    expect(res.status).toBe(200)
    const toggled = (await res.json()) as { done: boolean }
    expect(toggled.done).toBe(true)

    res = await a.fetch(
      new Request(`http://localhost/todos/${createdTodo.id}`, { method: "DELETE" }),
    )
    expect(res.status).toBe(200)

    res = await a.fetch(new Request("http://localhost/todos"))
    expect(await res.json()).toEqual([])
  })

  test("validation error on empty title", async () => {
    const res = await a.fetch(
      new Request("http://localhost/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "" }),
      }),
    )
    expect(res.status).toBe(400)
  })

  test("404 on toggling unknown id", async () => {
    const res = await a.fetch(
      new Request("http://localhost/todos/does-not-exist", { method: "PATCH" }),
    )
    expect(res.status).toBe(404)
  })

  test("emits one structured log event per request", async () => {
    await a.fetch(new Request("http://localhost/health"))
    expect(drain.events).toHaveLength(1)
    const event = drain.events[0]
    if (!event) throw new Error("expected a log event")
    expect(event.service).toBe("todo-example")
    expect(event.status).toBe(200)
    expect(event.path).toBe("/health")
    expect(event.duration_ms).toEqual(expect.any(Number))
  })
})
