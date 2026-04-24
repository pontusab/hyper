#!/usr/bin/env bun
/**
 * `bun create hyper <name>` — scaffolder.
 *
 *   bun create hyper my-app                  # minimal template
 *   bun create hyper my-app --template todo  # todo example
 *   bun create hyper my-app --template ai    # MCP-ready template
 */

import { mkdir, readdir } from "node:fs/promises"
import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dirname } from "node:path"
import { TEMPLATES, type TemplateName, scaffold } from "./scaffold.ts"

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith("--")) {
      const k = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith("-")) {
        flags[k] = next
        i++
      } else flags[k] = true
    } else positional.push(a)
  }
  const name = positional[0]
  if (!name || flags.help === true) {
    console.error("usage: bun create hyper <name> [--template minimal|todo|ai]")
    return 2
  }
  const template: TemplateName =
    typeof flags.template === "string" && (TEMPLATES as readonly string[]).includes(flags.template)
      ? (flags.template as TemplateName)
      : "minimal"
  const dir = resolve(process.cwd(), name)
  await mkdir(dir, { recursive: true })
  const existing = await readdir(dir).catch(() => [])
  if (existing.length > 0 && flags.force !== true) {
    console.error(`error: ${dir} is not empty. Pass --force to overwrite.`)
    return 1
  }
  const files = scaffold({ dir, name, template })
  for (const f of files) {
    const abs = resolve(dir, f.path)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, f.contents)
  }
  console.log(`scaffolded ${name} (${template}) → ${dir}`)
  console.log(`  cd ${name}`)
  console.log("  bun install")
  console.log("  bun dev")
  return 0
}

main().then((code) => process.exit(code))
