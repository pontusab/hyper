/**
 * `hyper diff <component>` — three-way drift inspection.
 *
 * Shows, for each file in a component:
 *   - unchanged      hash matches registry
 *   - local-changed  sha differs; prints a unified-style line diff
 *   - missing        the file wasn't installed (run `hyper add`)
 */

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ParsedArgs } from "../args.ts"
import { findComponent } from "./add.ts"

export async function runDiff(args: ParsedArgs): Promise<number> {
  const name = args.positional[0]
  if (!name) {
    console.error("usage: hyper diff <component>")
    return 2
  }
  const component = await findComponent(name)
  if (!component) {
    console.error(`unknown component: ${name}`)
    return 2
  }
  const root = process.cwd()
  let drift = 0
  for (const f of component.files) {
    const target = resolve(root, f.path)
    const local = await readIfExists(target)
    if (!local) {
      console.log(`missing  ${f.path}`)
      drift += 1
      continue
    }
    const hash = await sha256(local)
    if (hash === f.sha256) {
      console.log(`ok       ${f.path}`)
      continue
    }
    drift += 1
    console.log(`drift    ${f.path}`)
    const changes = lineDiff(f.contents, local)
    for (const c of changes.slice(0, 20)) console.log(`   ${c}`)
    if (changes.length > 20) console.log(`   … (${changes.length - 20} more)`)
  }
  return drift > 0 ? 1 : 0
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
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
