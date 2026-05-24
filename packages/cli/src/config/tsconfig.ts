/**
 * Minimal `tsconfig.json` reader/writer aware of JSONC (line + block comments
 * and trailing commas) — many bun/node projects use a JSONC tsconfig.
 *
 * We only need to:
 *   - read `compilerOptions.paths`
 *   - upsert `<alias>/*` mappings under `paths`
 *   - write back with comments and trailing commas preserved
 *
 * Strategy: read as JSONC into a JS object, mutate, write back with
 * `JSON.stringify(_, null, 2)`. Comments/trailing commas are stripped on
 * write — that's a deliberate trade-off (the user can re-add them) since
 * preserving them losslessly would require a full CST parser.
 */

import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

export interface TsConfig {
  extends?: string
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
    [k: string]: unknown
  }
  include?: string[]
  exclude?: string[]
  files?: string[]
  [k: string]: unknown
}

/** Parse JSONC by stripping `//` line comments, `/* *\/` block comments, and trailing commas. */
export function parseJsonc(input: string): unknown {
  let s = input
  // Strip line comments. Beware of "//" inside strings; we handle that by not
  // touching characters inside double-quoted spans.
  let out = ""
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '"') {
      // Copy entire string literal (incl. escape sequences) verbatim.
      const start = i
      i++
      while (i < s.length) {
        if (s[i] === "\\") {
          i += 2
          continue
        }
        if (s[i] === '"') {
          i++
          break
        }
        i++
      }
      out += s.slice(start, i)
      continue
    }
    if (c === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++
      continue
    }
    if (c === "/" && s[i + 1] === "*") {
      i += 2
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  s = out
  // Strip trailing commas before `}` or `]`.
  s = s.replace(/,(\s*[}\]])/g, "$1")
  return JSON.parse(s) as unknown
}

export async function readTsConfig(cwd: string = process.cwd()): Promise<{
  raw: string
  parsed: TsConfig
} | null> {
  const path = resolve(cwd, "tsconfig.json")
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
  }
  return { raw, parsed: parseJsonc(raw) as TsConfig }
}

export async function writeTsConfig(config: TsConfig, cwd: string = process.cwd()): Promise<void> {
  const path = resolve(cwd, "tsconfig.json")
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`)
}

/**
 * Add `"<alias>/*": ["./<baseDir>/*", "./<baseDir>/*\/index.ts"]` to
 * `compilerOptions.paths`. Idempotent: if the mapping already exists with
 * the same value, returns the same config unchanged.
 */
export function upsertAlias(
  config: TsConfig,
  alias: string,
  baseDir: string,
): { config: TsConfig; changed: boolean } {
  if (alias === "relative") return { config, changed: false }
  const key = `${alias}/*`
  const dir = baseDir.replace(/\/+$/, "")
  const value = [`./${dir}/*`, `./${dir}/*/index.ts`]
  const existing = config.compilerOptions?.paths?.[key]
  if (existing && JSON.stringify(existing) === JSON.stringify(value)) {
    return { config, changed: false }
  }
  const next: TsConfig = {
    ...config,
    compilerOptions: {
      ...config.compilerOptions,
      paths: { ...config.compilerOptions?.paths, [key]: value },
    },
  }
  return { config: next, changed: true }
}

/** Convenience: read → upsert → write, only writing if something changed. */
export async function patchTsConfig(
  alias: string,
  baseDir: string,
  cwd: string = process.cwd(),
): Promise<"missing" | "unchanged" | "patched"> {
  const cur = await readTsConfig(cwd)
  if (!cur) return "missing"
  const { config: next, changed } = upsertAlias(cur.parsed, alias, baseDir)
  if (!changed) return "unchanged"
  await writeTsConfig(next, cwd)
  return "patched"
}
