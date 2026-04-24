/**
 * Prisma $extends() compatible helper — adds per-query timing events.
 *
 * Usage:
 *   const prisma = new PrismaClient().$extends(prismaLogExtension(() => ctx.log))
 */

import type { LogBuilder } from "./types.ts"

type GetLog = () => LogBuilder | undefined

// biome-ignore lint/suspicious/noExplicitAny: Prisma extension is dynamic by design
export function prismaLogExtension(getLog: GetLog): any {
  return {
    name: "@usehyper/log",
    query: {
      $allOperations: async ({
        model,
        operation,
        query,
        args,
      }: {
        model?: string
        operation: string
        // biome-ignore lint/suspicious/noExplicitAny: Prisma next
        query: (args: any) => Promise<unknown>
        // biome-ignore lint/suspicious/noExplicitAny: Prisma args
        args: any
      }): Promise<unknown> => {
        const start = performance.now()
        const log = getLog()
        try {
          const out = await query(args)
          log
            ?.child("db.query")
            .set({ model, operation, took_ms: performance.now() - start })
            .finish()
          return out
        } catch (e) {
          log
            ?.child("db.query")
            .set({ model, operation, took_ms: performance.now() - start, err: String(e) })
            .level("error")
            .finish()
          throw e
        }
      },
    },
  }
}
