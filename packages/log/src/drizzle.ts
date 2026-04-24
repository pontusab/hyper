/**
 * Query-event helper for Drizzle. Not a hard dependency — users wire it
 * themselves with their own drizzle instance.
 *
 * Usage:
 *   import { drizzle } from "drizzle-orm/bun-sqlite"
 *   import { wrapDrizzle } from "@usehyper/log/drizzle"
 *   const db = wrapDrizzle(drizzle(...), () => ctx.log)
 */

import type { LogBuilder } from "./types.ts"

type GetLog = () => LogBuilder | undefined

/**
 * Minimal interface so we don't depend on drizzle-orm types.
 * Works against any object exposing an `execute(query)` or similar.
 */
interface ExecutableDb {
  // biome-ignore lint/suspicious/noExplicitAny: user's drizzle instance
  execute?: (q: unknown, ...rest: any[]) => Promise<unknown>
  // biome-ignore lint/suspicious/noExplicitAny: user's drizzle instance
  run?: (q: unknown, ...rest: any[]) => Promise<unknown>
}

export function wrapDrizzle<Db extends ExecutableDb>(db: Db, getLog: GetLog): Db {
  const hook = async (method: "execute" | "run", q: unknown, rest: unknown[]) => {
    const start = performance.now()
    const log = getLog()
    try {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch
      const out = await (db[method] as any).call(db, q, ...rest)
      log
        ?.child("db.query")
        .set({ method, took_ms: performance.now() - start })
        .finish()
      return out
    } catch (e) {
      log
        ?.child("db.query")
        .set({ method, took_ms: performance.now() - start, err: String(e) })
        .level("error")
        .finish()
      throw e
    }
  }
  const patched = { ...db }
  if (typeof db.execute === "function") {
    // biome-ignore lint/suspicious/noExplicitAny: preserving user's types
    ;(patched as any).execute = (q: unknown, ...rest: any[]) => hook("execute", q, rest)
  }
  if (typeof db.run === "function") {
    // biome-ignore lint/suspicious/noExplicitAny: preserving user's types
    ;(patched as any).run = (q: unknown, ...rest: any[]) => hook("run", q, rest)
  }
  return patched as Db
}
