/**
 * `hyper update [component...]` — bump installed components to the
 * latest registry version.
 *
 * Strategy: for each component listed in the lockfile (or the explicit
 * positional list), fetch the latest manifest from the registry. If the
 * version is newer, re-apply the component (subject to the same drift
 * protection as `hyper add`).
 *
 * Conflicts are reported and skip that component's update — fix them with
 * `hyper diff` + commit, or pass `--force`.
 */

import { type ParsedArgs, isJson } from "../args.ts"
import { readConfig, readLock, writeLock } from "../config/index.ts"
import { applyComponents, createRegistryClient } from "../registry/index.ts"

export async function runUpdate(args: ParsedArgs): Promise<number> {
  const config = await readConfig()
  const client = createRegistryClient({ url: config.registryUrl })
  const lock = await readLock()

  const installed = Object.keys(lock.components)
  if (installed.length === 0) {
    console.error("no components installed (run `hyper add <component>` first)")
    return 2
  }

  const targets = args.positional.length > 0 ? args.positional : installed
  const force = args.flags.force === true
  const dryRun = args.flags["dry-run"] === true || args.flags.n === true

  const candidates: { name: string; from: string; to: string }[] = []
  for (const name of targets) {
    const cur = lock.components[name]
    if (!cur) {
      console.error(`not installed: ${name}`)
      continue
    }
    const latest = await client.getComponent(name).catch(() => null)
    if (!latest) {
      console.error(`fetch failed: ${name}`)
      continue
    }
    if (latest.version !== cur.version) {
      candidates.push({ name, from: cur.version, to: latest.version })
    }
  }

  if (candidates.length === 0) {
    if (isJson(args.flags)) console.log(JSON.stringify({ updated: [], dryRun }))
    else console.log("everything up-to-date.")
    return 0
  }

  if (isJson(args.flags) && dryRun) {
    console.log(JSON.stringify({ candidates, dryRun: true }))
    return 0
  }

  const outcome = await applyComponents(
    candidates.map((c) => c.name),
    {
      cwd: process.cwd(),
      config,
      client,
      lock,
      force,
      dryRun,
    },
  )

  if (outcome.conflicts.length > 0) {
    console.error("conflicts (use --force, or `hyper diff <component>` first):")
    for (const c of outcome.conflicts) console.error(`  ${c.path}  (${c.component})`)
    return 1
  }

  if (!dryRun) await writeLock(outcome.lock)

  if (isJson(args.flags)) {
    console.log(JSON.stringify({ updated: candidates, written: outcome.written, dryRun }))
    return 0
  }

  for (const c of candidates) console.log(`  ${c.name}: ${c.from} → ${c.to}`)
  console.log(
    `${dryRun ? "(dry-run) " : ""}${candidates.length} component(s) updated, ${outcome.written.length} file(s) ${dryRun ? "would be " : ""}written.`,
  )
  return 0
}
