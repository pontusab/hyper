import { beforeEach, describe, expect, test } from "bun:test"
import { type HyperApp, app, conflict, created, notFound, ok, route } from "@hyper/core"
import { hyperLog, memoryDrain } from "@hyper/log"
import { CreateTodo, TodoParams } from "../src/schemas.ts"
import { memoryStore } from "../src/store.ts"

// Build a fresh app per-test so the store is isolated.
function buildApp(): { app: HyperApp; drain: ReturnType<typeof memoryDrain> } {
  const drain = memoryDrain()
  const health = route.get("/health").handle(() => ok({ ok: true }))
  const list = route.get("/todos").handle(async (c) => {
    return ok(await (c.ctx as unknown as { store: ReturnType<typeof memoryStore> }).store.list())
  })
  const create = route
    .post("/todos")
    .body(CreateTodo)
    .handle(async (c) => {
      const store = (c.ctx as unknown as { store: ReturnType<typeof memoryStore> }).store
      return created(await store.create({ title: c.body.title }))
    })
  const toggle = route
    .patch("/todos/:id")
    .params(TodoParams)
    .handle(async (c) => {
      const store = (c.ctx as unknown as { store: ReturnType<typeof memoryStore> }).store
      const updated = await store.toggle(c.params.id)
      return updated ? ok(updated) : notFound({ id: c.params.id })
    })
  const remove = route
    .delete("/todos/:id")
    .params(TodoParams)
    .handle(async (c) => {
      const store = (c.ctx as unknown as { store: ReturnType<typeof memoryStore> }).store
      const removed = await store.remove(c.params.id)
      return removed ? ok({ removed: c.params.id }) : conflict({ id: c.params.id })
    })

  return {
    app: app({
      routes: [health, list, create, toggle, remove],
      decorate: [() => ({ store: memoryStore() })],
      plugins: [hyperLog({ drains: [drain], service: "todo-example" })],
    }),
    drain,
  }
}

describe("todo example", () => {
  let a: HyperApp
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
    // list: empty
    let res = await a.fetch(new Request("http://localhost/todos"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])

    // create
    res = await a.fetch(
      new Request("http://localhost/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "buy milk" }),
      }),
    )
    expect(res.status).toBe(201)
    const created = (await res.json()) as { id: string; title: string; done: boolean }
    expect(created.title).toBe("buy milk")
    expect(created.done).toBe(false)

    // toggle
    res = await a.fetch(new Request(`http://localhost/todos/${created.id}`, { method: "PATCH" }))
    expect(res.status).toBe(200)
    const toggled = (await res.json()) as { done: boolean }
    expect(toggled.done).toBe(true)

    // remove
    res = await a.fetch(new Request(`http://localhost/todos/${created.id}`, { method: "DELETE" }))
    expect(res.status).toBe(200)

    // list: empty again
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
    const event = drain.events[0]!
    expect(event.service).toBe("todo-example")
    expect(event.status).toBe(200)
    expect(event.path).toBe("/health")
    expect(event.duration_ms).toEqual(expect.any(Number))
  })
})
