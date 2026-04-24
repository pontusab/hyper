import { type ChildProcess, spawn } from "node:child_process"
import type { ParsedArgs } from "../args.ts"
import { resolveEntry } from "../entry.ts"

/**
 * `hyper dev` — run the app with Bun hot reload + tsgo --watch alongside.
 *
 * We prefer a Bun-native single-process hot reload (`bun --hot` uses
 * `server.reload` under the hood to keep the open sockets alive). The
 * type-checker runs as a sibling process so incremental type errors
 * surface in the terminal without blocking request-handling.
 *
 * Flags:
 *   --test     also run `bun test --watch` in a third sibling process
 *   --no-types skip `tsgo --watch` (useful when tsgo isn't available)
 */
export async function runDev(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found (tried src/app.ts, app.ts, src/index.ts)")
    return 2
  }
  const children: ChildProcess[] = []
  const bun = spawn("bun", ["--hot", entry], { stdio: "inherit" })
  children.push(bun)

  const runTypes = args.flags.types !== false && args.flags["no-types"] !== true
  if (runTypes) {
    const tsgo = spawn("tsgo", ["--noEmit", "--watch", "-p", "tsconfig.json"], {
      stdio: "inherit",
    })
    tsgo.on("error", () => {})
    children.push(tsgo)
  }

  if (args.flags.test === true) {
    const test = spawn("bun", ["test", "--watch"], { stdio: "inherit" })
    test.on("error", () => {})
    children.push(test)
  }

  const cleanup = (): void => {
    for (const c of children) c.kill("SIGTERM")
  }
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
  return new Promise<number>((res) => {
    bun.on("exit", (code) => {
      for (const c of children) if (c !== bun) c.kill("SIGTERM")
      res(code ?? 0)
    })
  })
}
