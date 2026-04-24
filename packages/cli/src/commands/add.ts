/**
 * `hyper add <component>` — Shadcn-style "copy files into the repo".
 *
 *   hyper add adapter-bun         # materialize src/adapters/bun.ts
 *   hyper add auth                # materialize the auth recipe + deps
 *
 * Content-hash verified: if a target file exists but differs from the
 * registry hash, we refuse to overwrite and tell the user to run
 * `hyper diff` to inspect the drift.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { ParsedArgs } from "../args.ts"
import { type RegistryComponent, type RegistryFile, buildLocalRegistry } from "../registry/local.ts"

export async function runAdd(args: ParsedArgs): Promise<number> {
  const name = args.positional[0]
  if (!name) {
    console.error("usage: hyper add <component> [--force]")
    return 2
  }
  const registry = await buildLocalRegistry()

  if (name === "list" || args.flags.list === true) {
    for (const c of registry) console.log(`  ${c.name.padEnd(20)} ${c.description}`)
    return 0
  }

  const component = registry.find((c) => c.name === name)
  if (!component) {
    console.error(`unknown component: ${name}`)
    console.error("try `hyper add list` to see what's available.")
    return 2
  }

  const force = args.flags.force === true
  const root = process.cwd()
  let written = 0
  let skipped = 0
  for (const f of component.files) {
    const target = resolve(root, f.path)
    const existing = await readIfExists(target)
    if (existing) {
      const same = await sameHash(existing, f.sha256)
      if (same) {
        skipped += 1
        continue
      }
      if (!force) {
        console.error(
          `conflict: ${f.path} differs from registry. Re-run with --force or use \`hyper diff\`.`,
        )
        return 1
      }
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, f.contents)
    written += 1
  }
  console.log(`installed ${component.name}: ${written} file(s) written, ${skipped} up-to-date`)
  if (component.dependencies?.length) {
    console.log(`  run \`bun add ${component.dependencies.join(" ")}\` to install runtime deps.`)
  }
  return 0
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}
async function sameHash(contents: string, expected: string): Promise<boolean> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contents))
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hex === expected
}

/** Preserve for the `hyper diff` command. */
export async function findComponent(name: string): Promise<RegistryComponent | undefined> {
  return (await buildLocalRegistry()).find((c) => c.name === name)
}
export type { RegistryFile }
