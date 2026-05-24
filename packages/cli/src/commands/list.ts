/**
 * `hyper list` / `hyper search <q>` — browse the registry from the CLI.
 *
 * Reads the index manifest and prints a name/version/description table.
 * Supports `--json` and a substring filter via positional `query` (used by
 * `hyper search`).
 */

import { type ParsedArgs, isJson } from "../args.ts"
import { readConfig } from "../config/index.ts"
import { createRegistryClient } from "../registry/index.ts"

export async function runList(args: ParsedArgs): Promise<number> {
  const config = await readConfig()
  const client = createRegistryClient({ url: config.registryUrl })
  const index = await client.getIndex()
  const q = args.positional[0]?.toLowerCase()
  const filtered = q
    ? index.components.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.registryDeps.some((d) => d.toLowerCase().includes(q)),
      )
    : index.components

  if (isJson(args.flags)) {
    console.log(JSON.stringify(filtered, null, 2))
    return 0
  }

  if (filtered.length === 0) {
    console.log(q ? `no components matching "${q}"` : "no components in registry")
    return 0
  }

  const w = Math.max(8, ...filtered.map((c) => c.name.length))
  console.log(`registry: ${client.url}`)
  console.log(`${"name".padEnd(w)}  version  description`)
  console.log(`${"".padEnd(w, "-")}  -------  -----------`)
  for (const c of filtered) {
    console.log(`${c.name.padEnd(w)}  ${c.version.padEnd(7)}  ${c.description}`)
  }
  console.log(`\n${filtered.length} component(s)`)
  return 0
}
