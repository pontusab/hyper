/**
 * bun:sqlite-backed CacheStore. Persistent, zero-dependency, ~10k rps.
 *
 *   import { sqliteCache } from "@usehyper/cache/sqlite"
 *   const store = sqliteCache({ path: "./cache.sqlite" })
 *   use(cache({ maxAge: 60, store }))
 *
 * The schema is WAL-mode, synchronous=NORMAL, with a size/entry cap.
 * Sweeps happen on read (lazy) and on `.sweep()` (manual).
 */

import { Database } from "bun:sqlite"
import type { CacheEntry, CacheStore } from "./index.ts"

export interface SqliteCacheOptions {
  /** File path. `":memory:"` for RAM-only. Default: `./.hyper/cache.sqlite`. */
  readonly path?: string
  /** Max entries; oldest evicted first. Default: 100_000. */
  readonly maxEntries?: number
}

export function sqliteCache(opts: SqliteCacheOptions = {}): CacheStore & {
  readonly sweep: () => void
  readonly close: () => void
} {
  const path = opts.path ?? "./.hyper/cache.sqlite"
  const maxEntries = opts.maxEntries ?? 100_000
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyper_cache (
      k TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      headers TEXT NOT NULL,
      body BLOB NOT NULL,
      etag TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hyper_cache_created_at ON hyper_cache (created_at);
  `)
  const stmtGet = db.prepare(
    "SELECT status, headers, body, etag, created_at AS createdAt FROM hyper_cache WHERE k = ?",
  )
  const stmtSet = db.prepare(
    "INSERT OR REPLACE INTO hyper_cache (k, status, headers, body, etag, created_at) VALUES (?,?,?,?,?,?)",
  )
  const stmtCount = db.prepare("SELECT COUNT(*) AS c FROM hyper_cache")
  const stmtPrune = db.prepare(
    "DELETE FROM hyper_cache WHERE rowid IN (SELECT rowid FROM hyper_cache ORDER BY created_at ASC LIMIT ?)",
  )

  const sweep = () => {
    const row = stmtCount.get() as { c: number } | undefined
    if (row && row.c > maxEntries) {
      stmtPrune.run(row.c - maxEntries)
    }
  }

  return {
    async get(key) {
      const row = stmtGet.get(key) as
        | { status: number; headers: string; body: Uint8Array; etag: string; createdAt: number }
        | undefined
      if (!row) return undefined
      return {
        status: row.status,
        headers: JSON.parse(row.headers) as Record<string, string>,
        body: row.body,
        etag: row.etag,
        createdAt: row.createdAt,
      } satisfies CacheEntry
    },
    async set(key, value) {
      stmtSet.run(
        key,
        value.status,
        JSON.stringify(value.headers),
        value.body,
        value.etag,
        value.createdAt,
      )
      sweep()
    },
    sweep,
    close: () => db.close(),
  }
}
