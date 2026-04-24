/**
 * Simple in-memory notes store. The agent reads + writes through the
 * HTTP API, which is the same surface exposed via MCP — one set of
 * routes, two protocols.
 */

export interface Note {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly createdAt: number
}

export interface NoteStore {
  list(): Promise<readonly Note[]>
  create(input: { title: string; content: string }): Promise<Note>
  search(input: { q: string }): Promise<readonly Note[]>
}

export function memoryNotes(): NoteStore {
  const items = new Map<string, Note>()
  return {
    async list() {
      return Array.from(items.values()).sort((a, b) => b.createdAt - a.createdAt)
    },
    async create({ title, content }) {
      const n: Note = {
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: Date.now(),
      }
      items.set(n.id, n)
      return n
    },
    async search({ q }) {
      const needle = q.toLowerCase()
      return Array.from(items.values()).filter(
        (n) => n.title.toLowerCase().includes(needle) || n.content.toLowerCase().includes(needle),
      )
    },
  }
}
