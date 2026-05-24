import { type HyperApp, app, conflict, created, notFound, ok, route } from "@hyper/core"
import { hyperLog } from "@hyper/log"
import { CreateTodo, TodoParams } from "./schemas.ts"
import { type TodoStore, memoryStore } from "./store.ts"

declare module "@hyper/core" {
  interface AppContext {
    readonly store: TodoStore
  }
}

const health = route.get("/health").handle(() => ok({ ok: true }))

const list = route.get("/todos").handle(async (c) => {
  return ok(await c.ctx.store.list())
})

const create = route
  .post("/todos")
  .body(CreateTodo)
  .handle(async (c) => {
    const todo = await c.ctx.store.create({ title: c.body.title })
    return created(todo)
  })

const toggle = route
  .patch("/todos/:id")
  .params(TodoParams)
  .handle(async (c) => {
    const updated = await c.ctx.store.toggle(c.params.id)
    if (!updated) return notFound({ code: "not_found" })
    return ok(updated)
  })

const remove = route
  .delete("/todos/:id")
  .params(TodoParams)
  .handle(async (c) => {
    const removed = await c.ctx.store.remove(c.params.id)
    if (!removed) return conflict({ code: "not_found_or_already_removed" })
    return ok({ removed: c.params.id })
  })

const a: HyperApp = app({
  routes: [health, list, create, toggle, remove],
  decorate: [() => ({ store: memoryStore() })],
  plugins: [hyperLog({ service: "todo-example" })],
})

export default a
