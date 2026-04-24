/**
 * bun:sqlite-backed RateLimitStore — survives process restart; well-
 * suited for single-node deployments. For multi-node, use Redis.
 */

import { Database } from "bun:sqlite"
import type { RateLimitResult, RateLimitStore } from "./index.ts"

export interface SqliteRateLimitOptions {
  readonly path?: string
}

export function sqliteRateLimit(opts: SqliteRateLimitOptions = {}): RateLimitStore & {
  readonly sweep: () => void
  readonly close: () => void
} {
  const path = opts.path ?? "./.hyper/rate-limit.sqlite"
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyper_rl (
      k TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `)
  const stmtGet = db.prepare("SELECT count, reset_at AS resetAt FROM hyper_rl WHERE k = ?")
  const stmtInit = db.prepare(
    "INSERT OR REPLACE INTO hyper_rl (k, count, reset_at) VALUES (?, 1, ?)",
  )
  const stmtBump = db.prepare("UPDATE hyper_rl SET count = count + 1 WHERE k = ?")
  const stmtSweep = db.prepare("DELETE FROM hyper_rl WHERE reset_at < ?")

  return {
    async take(key, limit, windowMs): Promise<RateLimitResult> {
      const now = Date.now()
      const row = stmtGet.get(key) as { count: number; resetAt: number } | undefined
      if (!row || row.resetAt <= now) {
        stmtInit.run(key, now + windowMs)
        return { allowed: true, remaining: Math.max(0, limit - 1), resetMs: windowMs }
      }
      stmtBump.run(key)
      const count = row.count + 1
      const allowed = count <= limit
      return { allowed, remaining: Math.max(0, limit - count), resetMs: row.resetAt - now }
    },
    sweep: () => {
      stmtSweep.run(Date.now())
    },
    close: () => db.close(),
  }
}
