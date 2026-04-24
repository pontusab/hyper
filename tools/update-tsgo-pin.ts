#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
/**
 * update-tsgo-pin.ts <new-version>
 *
 * Rewrites every package.json in the workspace that pins
 * @typescript/native-preview to the new version. Used by the
 * weekly renovate workflow.
 */
import { Glob } from "bun"

const next = process.argv[2]
if (!next) {
  console.error("Usage: update-tsgo-pin.ts <version>")
  process.exit(1)
}

const root = resolve(import.meta.dir, "..")
const glob = new Glob("{,packages/*/,apps/*/,apps/examples/*/}package.json")

let touched = 0
for await (const rel of glob.scan(root)) {
  const path = resolve(root, rel)
  const raw = await readFile(path, "utf8")
  const pkg = JSON.parse(raw)
  let mutated = false
  for (const key of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const deps = pkg[key]
    if (deps?.["@typescript/native-preview"]) {
      deps["@typescript/native-preview"] = next
      mutated = true
    }
  }
  if (mutated) {
    await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
    touched++
    console.log(`updated ${rel}`)
  }
}

console.log(`done. ${touched} package.json files updated to ${next}.`)
