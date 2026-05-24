/**
 * wrapQueries(db, getLog) — a generic helper that records query timing
 * on any object exposing async methods. Works out-of-the-box with Drizzle,
 * Prisma, Bun.sql wrappers, and hand-rolled repositories.
 *
 * The contract is minimal: every method is wrapped; synchronous methods
 * are passed through. Errors are logged at `error` level.
 */

import type { LogBuilder } from "./types.ts"

type GetLog = () => LogBuilder | undefined

// biome-ignore lint/suspicious/noExplicitAny: user's repo/orm shape is opaque
export function wrapQueries<T extends Record<string, any>>(db: T, getLog: GetLog): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver)
      if (typeof v !== "function") return v
      return (...args: unknown[]) => {
        const start = performance.now()
        const label = String(prop)
        try {
          const result = (v as (...a: unknown[]) => unknown).apply(target, args)
          if (result && typeof (result as Promise<unknown>).then === "function") {
            return (result as Promise<unknown>).then(
              (out) => {
                getLog()
                  ?.child("db.query")
                  .set({ method: label, took_ms: performance.now() - start })
                  .finish()
                return out
              },
              (err: unknown) => {
                getLog()
                  ?.child("db.query")
                  .set({ method: label, took_ms: performance.now() - start, err: String(err) })
                  .level("error")
                  .finish()
                throw err
              },
            )
          }
          getLog()
            ?.child("db.query")
            .set({ method: label, took_ms: performance.now() - start })
            .finish()
          return result
        } catch (err) {
          getLog()
            ?.child("db.query")
            .set({ method: label, took_ms: performance.now() - start, err: String(err) })
            .level("error")
            .finish()
          throw err
        }
      }
    },
  }) as T
}
