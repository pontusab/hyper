/**
 * `.env.local` merger for `hyper add`.
 *
 * When a component declares `envVars`, the CLI appends entries to the
 * project's `.env.local`, leaving any existing keys untouched. Re-running
 * `hyper add` is therefore idempotent: secrets are generated exactly once.
 *
 * Two kinds of `${...}` interpolation are resolved LOCALLY (so secrets
 * never leave the user's machine):
 *
 *   ${random:hex:N}     -> N random bytes encoded as 2N hex chars
 *   ${random:base64:N}  -> N random bytes encoded as base64
 *
 * Anything else (including unknown `${...}` forms) is written through
 * verbatim. Users can fill those in by hand.
 */

import { randomBytes } from "node:crypto"

export interface EnvMergeResult {
  /** New file contents (unchanged + appended block). */
  readonly merged: string
  /** Keys we added in this run. */
  readonly added: readonly string[]
  /** Keys that were already present and left as-is. */
  readonly preserved: readonly string[]
}

/**
 * Merge a flat record of `KEY -> value-template` into an existing `.env`
 * file body. Existing keys are preserved verbatim; new keys are appended
 * with their `${random:...}` placeholders resolved.
 *
 * Pure function: no I/O, no clock, no env access. Callers handle the
 * file read + write + dry-run gating.
 */
export function mergeEnvFile(
  existing: string,
  vars: Readonly<Record<string, string>>,
): EnvMergeResult {
  const known = parseEnvKeys(existing)
  const added: string[] = []
  const preserved: string[] = []
  const newLines: string[] = []

  // Stable order: alphabetical by key, so re-runs produce reproducible diffs.
  const keys = Object.keys(vars).sort()
  for (const key of keys) {
    if (known.has(key)) {
      preserved.push(key)
      continue
    }
    const template = vars[key] ?? ""
    const value = resolveInterpolations(template)
    newLines.push(`${key}=${formatValue(value)}`)
    added.push(key)
  }

  if (newLines.length === 0) {
    return { merged: existing, added, preserved }
  }

  // Existing body keeps its content verbatim. We strip *all* trailing
  // newlines, then separate with exactly one blank line before the new
  // block. Pre-empty files just get the block itself.
  const trimmed = existing.replace(/(?:\r?\n)+$/g, "")
  const header = "# Added by `hyper add`"
  const block = `${header}\n${newLines.join("\n")}\n`
  const merged = trimmed === "" ? block : `${trimmed}\n\n${block}`
  return { merged, added, preserved }
}

/**
 * Parse just the keys defined in an `.env` file body. Tolerates blank lines,
 * `# comments`, `export FOO=…` prefixes, and quoted values. We do NOT need
 * to evaluate the values — only know which keys are taken.
 */
function parseEnvKeys(body: string): Set<string> {
  const keys = new Set<string>()
  for (const rawLine of body.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim()
    if (line === "") continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (m?.[1]) keys.add(m[1])
  }
  return keys
}

function stripComment(line: string): string {
  // A `#` only starts a comment when not inside quotes. Cheap heuristic:
  // scan once, flipping a quote state. Good enough for the limited set of
  // shapes a `.env.local` ever contains.
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "\\") {
      i++
      continue
    }
    if (!inDouble && ch === "'") inSingle = !inSingle
    else if (!inSingle && ch === '"') inDouble = !inDouble
    else if (!inSingle && !inDouble && ch === "#") return line.slice(0, i)
  }
  return line
}

const RANDOM_HEX_RE = /^\$\{random:hex:(\d+)\}$/
const RANDOM_B64_RE = /^\$\{random:base64:(\d+)\}$/

function resolveInterpolations(template: string): string {
  // Whole-string interpolation only. Mid-string `${...}` is rare in
  // .env.local conventions and ambiguous to escape; keep the contract small.
  const hex = RANDOM_HEX_RE.exec(template)
  if (hex?.[1]) {
    const n = Math.max(1, Math.min(1024, Number.parseInt(hex[1], 10)))
    return randomBytes(n).toString("hex")
  }
  const b64 = RANDOM_B64_RE.exec(template)
  if (b64?.[1]) {
    const n = Math.max(1, Math.min(1024, Number.parseInt(b64[1], 10)))
    return randomBytes(n).toString("base64")
  }
  return template
}

/**
 * Quote values that need it. Bare values (no whitespace, no `#`, no `$`,
 * etc.) stay unquoted to match the dominant `.env` convention.
 */
function formatValue(value: string): string {
  if (value === "") return ""
  if (/^[A-Za-z0-9_./:+\-=]+$/.test(value)) return value
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}
