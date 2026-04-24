/**
 * bun:sqlite-backed SessionStore — persistent, single-node production.
 * For multi-node, use Redis.
 */

import { Database } from "bun:sqlite"
import type { SessionStore } from "./index.ts"

export interface SqliteSessionOptions {
  readonly path?: string
}

export function sqliteSessions(opts: SqliteSessionOptions = {}): SessionStore & {
  readonly sweep: () => void
  readonly close: () => void
} {
  const path = opts.path ?? "./.hyper/sessions.sqlite"
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyper_sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hyper_sessions_expires ON hyper_sessions (expires);
  `)
  const stmtGet = db.prepare("SELECT data, expires FROM hyper_sessions WHERE id = ?")
  const stmtSet = db.prepare(
    "INSERT OR REPLACE INTO hyper_sessions (id, data, expires) VALUES (?, ?, ?)",
  )
  const stmtDel = db.prepare("DELETE FROM hyper_sessions WHERE id = ?")
  const stmtSweep = db.prepare("DELETE FROM hyper_sessions WHERE expires < ?")

  return {
    async get(id) {
      const row = stmtGet.get(id) as { data: string; expires: number } | undefined
      if (!row) return undefined
      if (row.expires < Date.now()) {
        stmtDel.run(id)
        return undefined
      }
      return JSON.parse(row.data) as Record<string, unknown>
    },
    async set(id, data, ttlMs) {
      stmtSet.run(id, JSON.stringify(data), Date.now() + ttlMs)
    },
    async destroy(id) {
      stmtDel.run(id)
    },
    sweep: () => {
      stmtSweep.run(Date.now())
    },
    close: () => db.close(),
  }
}
