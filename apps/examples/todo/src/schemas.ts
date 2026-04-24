/**
 * Minimal hand-rolled Standard Schemas. Users typically bring Zod or Valibot;
 * we stay dep-free here so the example compiles anywhere.
 */

import type { StandardSchemaV1 } from "@hyper/core"

function objectSchema<T>(
  validate: (v: unknown) => { value: T } | { issues: { message: string; path: string[] }[] },
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "todo-example",
      validate(v) {
        return validate(v) as ReturnType<StandardSchemaV1<unknown, T>["~standard"]["validate"]>
      },
    },
  }
}

export const CreateTodo = objectSchema<{ title: string }>((v) => {
  if (!v || typeof v !== "object") return { issues: [{ message: "expected object", path: [] }] }
  const title = (v as { title?: unknown }).title
  if (typeof title !== "string" || title.length === 0) {
    return { issues: [{ message: "title required", path: ["title"] }] }
  }
  if (title.length > 256) {
    return { issues: [{ message: "title too long", path: ["title"] }] }
  }
  return { value: { title } }
})

export const TodoParams = objectSchema<{ id: string }>((v) => {
  const id = (v as { id?: unknown }).id
  if (typeof id !== "string") {
    return { issues: [{ message: "id required", path: ["id"] }] }
  }
  return { value: { id } }
})
