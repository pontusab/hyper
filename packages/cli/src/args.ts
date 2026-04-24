/**
 * Minimal arg parser — no deps. Supports:
 *   hyper <command> [positional] [--flag value] [--bool] [-s]
 */

export interface ParsedArgs {
  readonly command: string | undefined
  readonly positional: readonly string[]
  readonly flags: Readonly<Record<string, string | boolean>>
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = rest[i + 1]
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else if (a.startsWith("-")) {
      flags[a.slice(1)] = true
    } else {
      positional.push(a)
    }
  }
  return { command, positional, flags }
}

export function isJson(flags: Readonly<Record<string, string | boolean>>): boolean {
  return flags.json === true || flags.json === "true"
}
