import type { StandardSchemaV1 } from "@hyper/core"

function obj<T>(
  validate: (v: unknown) => { value: T } | { issues: { message: string; path: string[] }[] },
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "ai-example",
      validate(v) {
        return validate(v) as ReturnType<StandardSchemaV1<unknown, T>["~standard"]["validate"]>
      },
    },
  }
}

export const CreateNote = obj<{ title: string; content: string }>((v) => {
  if (!v || typeof v !== "object") return { issues: [{ message: "expected object", path: [] }] }
  const r = v as { title?: unknown; content?: unknown }
  if (typeof r.title !== "string" || !r.title.length) {
    return { issues: [{ message: "title required", path: ["title"] }] }
  }
  if (typeof r.content !== "string") {
    return { issues: [{ message: "content required", path: ["content"] }] }
  }
  return { value: { title: r.title, content: r.content } }
})

export const SearchQuery = obj<{ q: string }>((v) => {
  const q = (v as { q?: unknown }).q
  if (typeof q !== "string" || q.length === 0) {
    return { issues: [{ message: "q required", path: ["q"] }] }
  }
  return { value: { q } }
})
