/**
 * bun:sqlite-backed IdempotencyStore — persistent across process restarts
 * and suitable for single-node production. For multi-node, use Redis.
 */

import { Database } from "bun:sqlite"
import type { CachedResponse, IdempotencyStore } from "./store.ts"

export interface SqliteIdempotencyOptions {
  readonly path?: string
}

export function sqliteIdempotency(opts: SqliteIdempotencyOptions = {}): IdempotencyStore & {
  readonly sweep: () => void
  readonly close: () => void
} {
  const path = opts.path ?? "./.hyper/idempotency.sqlite"
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyper_idempotency (
      k TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      headers TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hyper_idempotency_locks (
      k TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `)
  const now = () => Date.now()
  const stmtGet = db.prepare(
    "SELECT status, headers, body, created_at AS createdAt, expires_at AS expiresAt FROM hyper_idempotency WHERE k = ?",
  )
  const stmtSet = db.prepare(
    "INSERT OR REPLACE INTO hyper_idempotency (k, status, headers, body, created_at, expires_at) VALUES (?,?,?,?,?,?)",
  )
  const stmtLockGet = db.prepare(
    "SELECT expires_at AS expiresAt FROM hyper_idempotency_locks WHERE k = ?",
  )
  const stmtLockSet = db.prepare(
    "INSERT OR REPLACE INTO hyper_idempotency_locks (k, expires_at) VALUES (?, ?)",
  )
  const stmtLockDel = db.prepare("DELETE FROM hyper_idempotency_locks WHERE k = ?")
  const stmtSweep = db.prepare("DELETE FROM hyper_idempotency WHERE expires_at < ?")
  const stmtSweepLocks = db.prepare("DELETE FROM hyper_idempotency_locks WHERE expires_at < ?")

  const sweep = () => {
    const t = now()
    stmtSweep.run(t)
    stmtSweepLocks.run(t)
  }

  return {
    async get(key) {
      const row = stmtGet.get(key) as
        | { status: number; headers: string; body: string; createdAt: number; expiresAt: number }
        | undefined
      if (!row) return undefined
      if (row.expiresAt < now()) return undefined
      return {
        status: row.status,
        headers: JSON.parse(row.headers) as Record<string, string>,
        body: row.body,
        createdAt: row.createdAt,
      } satisfies CachedResponse
    },
    async set(key, value, ttlMs) {
      stmtSet.run(
        key,
        value.status,
        JSON.stringify(value.headers),
        value.body,
        value.createdAt,
        now() + ttlMs,
      )
    },
    async lock(key, ttlMs) {
      const row = stmtLockGet.get(key) as { expiresAt: number } | undefined
      if (row && row.expiresAt >= now()) return false
      stmtLockSet.run(key, now() + ttlMs)
      return true
    },
    async unlock(key) {
      stmtLockDel.run(key)
    },
    sweep,
    close: () => db.close(),
  }
}
