/**
 * `hyper diff <component>` — inspect drift between local files and the
 * registry version of a component.
 *
 * Output per file:
 *   ok        local sha matches registry (after applying the user's alias)
 *   drift     local sha differs from registry — print line-diff
 *   missing   the file isn't installed (run `hyper add` first)
 */

import type { ParsedArgs } from "../args.ts"
import { readConfig } from "../config/index.ts"
import {
  createRegistryClient,
  readLocalFile,
  resolveTarget,
  rewriteFile,
} from "../registry/index.ts"

export async function runDiff(args: ParsedArgs): Promise<number> {
  const name = args.positional[0]
  if (!name) {
    console.error("usage: hyper diff <component>")
    return 2
  }
  const config = await readConfig()
  const client = createRegistryClient({ url: config.registryUrl })
  const component = await client.getComponent(name).catch(() => null)
  if (!component) {
    console.error(`unknown component: ${name}`)
    return 2
  }

  const subpathsByComponent = new Map<string, Readonly<Record<string, string>>>([
    [component.name, component.subpaths],
  ])

  let drift = 0
  for (const f of component.files) {
    const resolved = resolveTarget(f, component.name, config.baseDir)
    const relPath = resolved.relPath
    const local = await readLocalFile(process.cwd(), config, component.name, f)
    if (local === null) {
      console.log(`missing  ${relPath}`)
      drift += 1
      continue
    }
    const expected = resolved.rewriteImports
      ? rewriteFile(f.contents, {
          alias: config.alias,
          targetPath: relPath,
          baseDir: config.baseDir,
          subpathsByComponent,
        })
      : f.contents
    if (local === expected) {
      console.log(`ok       ${relPath}`)
      continue
    }
    drift += 1
    console.log(`drift    ${relPath}`)
    const changes = lineDiff(expected, local)
    for (const c of changes.slice(0, 20)) console.log(`   ${c}`)
    if (changes.length > 20) console.log(`   … (${changes.length - 20} more)`)
  }
  return drift > 0 ? 1 : 0
}

function lineDiff(a: string, b: string): string[] {
  const aL = a.split("\n")
  const bL = b.split("\n")
  const max = Math.max(aL.length, bL.length)
  const out: string[] = []
  for (let i = 0; i < max; i++) {
    if (aL[i] === bL[i]) continue
    if (aL[i] !== undefined) out.push(`- ${aL[i]}`)
    if (bL[i] !== undefined) out.push(`+ ${bL[i]}`)
  }
  return out
}
