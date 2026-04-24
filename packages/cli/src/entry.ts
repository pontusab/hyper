/**
 * Entry-point resolution. Default order:
 *   1) The positional arg, if provided.
 *   2) src/app.ts
 *   3) app.ts
 *   4) src/index.ts
 *   5) index.ts
 */

import { resolve } from "node:path"

const CANDIDATES = ["src/app.ts", "app.ts", "src/index.ts", "index.ts"]

export async function resolveEntry(
  positional: readonly string[],
  cwd: string = process.cwd(),
): Promise<string | null> {
  const override = positional[0]
  if (override) {
    const p = resolve(cwd, override)
    if (await exists(p)) return p
    return null
  }
  for (const c of CANDIDATES) {
    const p = resolve(cwd, c)
    if (await exists(p)) return p
  }
  return null
}

async function exists(path: string): Promise<boolean> {
  if (typeof Bun !== "undefined") {
    return Bun.file(path).exists()
  }
  try {
    const { access } = await import("node:fs/promises")
    await access(path)
    return true
  } catch {
    return false
  }
}
