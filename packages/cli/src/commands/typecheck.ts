import { spawn } from "node:child_process"
import type { ParsedArgs } from "../args.ts"

export async function runTypecheck(args: ParsedArgs): Promise<number> {
  const tsconfig = typeof args.flags.p === "string" ? args.flags.p : "tsconfig.json"
  // Prefer tsgo (TypeScript 7 native preview); fall back to tsc.
  return new Promise((res) => {
    const child = spawn("tsgo", ["--noEmit", "-p", tsconfig], {
      stdio: "inherit",
    })
    child.on("error", () => {
      const fallback = spawn("bunx", ["tsc", "--noEmit", "-p", tsconfig], {
        stdio: "inherit",
      })
      fallback.on("exit", (code) => res(code ?? 1))
    })
    child.on("exit", (code) => res(code ?? 1))
  })
}
