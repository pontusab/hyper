/**
 * Bun.sql template-tag wrapper that emits query events.
 *
 * Usage:
 *   import { sql as raw } from "bun"
 *   import { wrapBunSql } from "@usehyper/log/bun-sql"
 *   const sql = wrapBunSql(raw, () => ctx.log)
 */

import type { LogBuilder } from "./types.ts"

type GetLog = () => LogBuilder | undefined
// biome-ignore lint/suspicious/noExplicitAny: Bun.sql is a template tag with many shapes
type BunSql = (strings: TemplateStringsArray, ...values: any[]) => Promise<unknown>

export function wrapBunSql(sql: BunSql, getLog: GetLog): BunSql {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  return ((strings: TemplateStringsArray, ...values: any[]): Promise<unknown> => {
    const start = performance.now()
    const log = getLog()
    return sql(strings, ...values).then(
      (out) => {
        log
          ?.child("db.query")
          .set({ took_ms: performance.now() - start })
          .finish()
        return out
      },
      (err) => {
        log
          ?.child("db.query")
          .set({ took_ms: performance.now() - start, err: String(err) })
          .level("error")
          .finish()
        throw err
      },
    )
  }) as BunSql
}
