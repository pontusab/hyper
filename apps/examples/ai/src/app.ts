/**
 * AI example — exposes a notes API via HTTP, MCP, and typed RPC.
 *
 * Each route is annotated with `meta.mcp` (description + auth hints) and
 * `.example()` contract tests so the agent can discover how to call it.
 */

import { type HyperApp, app, created, ok, route } from "@usehyper/core"
import { hyperLog } from "@usehyper/log"
import { CreateNote, SearchQuery } from "./schemas.ts"
import { type NoteStore, memoryNotes } from "./tools.ts"

declare module "@usehyper/core" {
  interface AppContext {
    readonly notes: NoteStore
  }
}

const health = route.get("/health").handle(() => ok({ ok: true }))

const listNotes = route
  .get("/notes")
  .meta({
    name: "notes.list",
    mcp: { description: "List all notes, newest first." },
  })
  .example({
    name: "empty at start",
    output: { status: 200, body: [] },
  })
  .handle(async (c) => ok(await c.ctx.notes.list()))

const createNote = route
  .post("/notes")
  .body(CreateNote)
  .meta({
    name: "notes.create",
    mcp: { description: "Create a note with a title and content." },
  })
  .handle(async (c) => created(await c.ctx.notes.create(c.body)))

const searchNotes = route
  .get("/notes/search")
  .query(SearchQuery)
  .meta({
    name: "notes.search",
    mcp: { description: "Full-text search notes by substring." },
  })
  .handle(async (c) => ok(await c.ctx.notes.search(c.query)))

const a: HyperApp = app({
  routes: [health, listNotes, createNote, searchNotes],
  decorate: [() => ({ notes: memoryNotes() })],
  plugins: [hyperLog({ service: "ai-example" })],
})

export default a
