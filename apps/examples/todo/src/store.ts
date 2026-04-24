/**
 * In-memory todo store. In a real app you'd swap this for:
 *
 *   // drizzle recipe:
 *   import { drizzle } from "drizzle-orm/bun-sqlite"
 *   import { wrapDrizzle } from "@usehyper/log/drizzle"
 *   const db = wrapDrizzle(drizzle(...), () => /* ctx.log *\/ undefined)
 *
 * The store is intentionally async so tests + benches look realistic.
 */

export interface Todo {
  readonly id: string
  readonly title: string
  readonly done: boolean
  readonly createdAt: number
}

export interface TodoStore {
  list(): Promise<readonly Todo[]>
  create(input: { title: string }): Promise<Todo>
  toggle(id: string): Promise<Todo | null>
  remove(id: string): Promise<boolean>
}

export function memoryStore(): TodoStore {
  const items = new Map<string, Todo>()
  return {
    async list() {
      return Array.from(items.values()).sort((a, b) => b.createdAt - a.createdAt)
    },
    async create({ title }) {
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        done: false,
        createdAt: Date.now(),
      }
      items.set(todo.id, todo)
      return todo
    },
    async toggle(id) {
      const existing = items.get(id)
      if (!existing) return null
      const updated = { ...existing, done: !existing.done }
      items.set(id, updated)
      return updated
    },
    async remove(id) {
      return items.delete(id)
    },
  }
}
