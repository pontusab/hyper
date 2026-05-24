/**
 * `hyper add <component>...` — copy component source into the user's repo.
 *
 *   hyper add cors                 # install cors + transitively required deps
 *   hyper add auth-jwt session     # install multiple
 *   hyper add cors --info          # print readme + file list, install nothing
 *   hyper add cors --force         # overwrite local edits
 *   hyper add cors --dry-run       # preview without writing
 *   hyper add list                 # list all available components
 *
 * Files are content-hash verified: a locally-edited file (sha differs from
 * lockfile + differs from registry) refuses to overwrite without --force.
 * If the local sha matches the lockfile but differs from the registry, that
 * counts as a clean update and is applied.
 */

import { type ParsedArgs, isJson } from "../args.ts"
import { readConfig, readLock, writeLock } from "../config/index.ts"
import { applyComponents, createRegistryClient } from "../registry/index.ts"

export async function runAdd(args: ParsedArgs): Promise<number> {
  const positional = args.positional
  if (positional.length === 0) {
    console.error("usage: hyper add <component>... [--force] [--dry-run] [--info] [--list]")
    return 2
  }

  const config = await readConfig()
  const client = createRegistryClient({ url: config.registryUrl })

  if (positional[0] === "list" || args.flags.list === true) {
    return await listComponents(client, args)
  }

  if (args.flags.info === true) {
    return await infoComponent(positional, client, args)
  }

  const lock = await readLock()
  const force = args.flags.force === true
  const dryRun = args.flags["dry-run"] === true || args.flags.n === true

  let outcome: Awaited<ReturnType<typeof applyComponents>>
  try {
    outcome = await applyComponents(positional, {
      cwd: process.cwd(),
      config,
      client,
      lock,
      force,
      dryRun,
    })
  } catch (err) {
    console.error(`error: ${(err as Error).message}`)
    return 1
  }

  if (outcome.conflicts.length > 0) {
    console.error("conflicts (use --force to overwrite, or `hyper diff <component>` to inspect):")
    for (const c of outcome.conflicts) console.error(`  ${c.path}  (${c.component})`)
    return 1
  }

  if (!dryRun && outcome.written.length > 0) {
    await writeLock(outcome.lock)
  }

  if (isJson(args.flags)) {
    const docsByComponent = collectDocs(outcome)
    console.log(
      JSON.stringify(
        {
          components: outcome.components.map((c) => ({
            name: c.name,
            version: c.version,
            ...(c.title !== undefined && { title: c.title }),
          })),
          written: outcome.written,
          unchanged: outcome.unchanged,
          peerDeps: outcome.peerDeps,
          optionalPeerDeps: outcome.optionalPeerDeps,
          envVars: outcome.envVars,
          docs: docsByComponent,
          warnings: outcome.warnings,
          dryRun,
        },
        null,
        2,
      ),
    )
    return 0
  }

  printOutcome(outcome, dryRun, config.alias)
  return 0
}

/** Map component name -> docs blurb, only for components that wrote files. */
function collectDocs(outcome: Awaited<ReturnType<typeof applyComponents>>): Record<string, string> {
  const touched = new Set(outcome.written.map((w) => w.component))
  const docs: Record<string, string> = {}
  for (const c of outcome.components) {
    if (c.docs && touched.has(c.name)) docs[c.name] = c.docs
  }
  return docs
}

async function listComponents(
  client: ReturnType<typeof createRegistryClient>,
  args: ParsedArgs,
): Promise<number> {
  const all = await client.listComponents()
  if (isJson(args.flags)) {
    console.log(JSON.stringify(all, null, 2))
    return 0
  }
  const w = Math.max(8, ...all.map((c) => c.name.length))
  console.log(`${"name".padEnd(w)}  version  description`)
  console.log(`${"".padEnd(w, "-")}  -------  -----------`)
  for (const c of all) {
    const summary = c.title ? `${c.title} — ${c.description}` : c.description
    console.log(`${c.name.padEnd(w)}  ${c.version.padEnd(7)}  ${summary}`)
  }
  return 0
}

async function infoComponent(
  names: readonly string[],
  client: ReturnType<typeof createRegistryClient>,
  args: ParsedArgs,
): Promise<number> {
  for (const name of names) {
    const c = await client.getComponent(name).catch((err) => {
      console.error(`error: ${(err as Error).message}`)
      return null
    })
    if (!c) return 2
    if (isJson(args.flags)) {
      console.log(JSON.stringify(c, null, 2))
      continue
    }
    console.log(`# ${c.name}@${c.version}`)
    console.log(c.description)
    if (c.registryDeps.length > 0) console.log(`\nneeds: ${c.registryDeps.join(", ")}`)
    if (Object.keys(c.peerDeps).length > 0) {
      console.log(
        `peers: ${Object.entries(c.peerDeps)
          .map(([k, v]) => `${k}@${v}`)
          .join(", ")}`,
      )
    }
    if (Object.keys(c.optionalPeerDeps).length > 0) {
      console.log(
        `optional peers: ${Object.entries(c.optionalPeerDeps)
          .map(([k, v]) => `${k}@${v}`)
          .join(", ")}`,
      )
    }
    if (c.envVars && Object.keys(c.envVars).length > 0) {
      console.log("\nenv vars (written to .env.local on install):")
      for (const [k, v] of Object.entries(c.envVars)) console.log(`  ${k}=${v}`)
    }
    console.log(`\nfiles (${c.files.length}):`)
    for (const f of c.files) console.log(`  ${f.path}`)
    if (c.docs) {
      console.log("\n# Setup notes\n")
      console.log(c.docs)
    }
    if (c.readme) {
      console.log(`\n${"-".repeat(60)}\n`)
      console.log(c.readme)
    }
  }
  return 0
}

function printOutcome(
  outcome: Awaited<ReturnType<typeof applyComponents>>,
  dryRun: boolean,
  alias: string,
): void {
  const tag = dryRun ? "(dry-run) " : ""
  const componentNames = outcome.components.map((c) => c.name).join(", ")
  console.log(`${tag}installed: ${componentNames}`)
  const newCount = outcome.written.filter((w) => w.reason === "new").length
  const updatedCount = outcome.written.filter((w) => w.reason === "updated").length
  const upToDateCount = outcome.unchanged.length
  console.log(
    `${tag}${newCount} new, ${updatedCount} updated, ${upToDateCount} up-to-date — alias: ${alias}`,
  )
  for (const w of outcome.written.slice(0, 30)) {
    console.log(`  ${w.reason === "new" ? "+" : "~"} ${w.path}`)
  }
  if (outcome.written.length > 30) console.log(`  ... (${outcome.written.length - 30} more)`)

  const peers = Object.entries(outcome.peerDeps)
  const optionalPeers = Object.entries(outcome.optionalPeerDeps)
  if (peers.length > 0) {
    console.log(`\nrun:  bun add ${peers.map(([k, v]) => `${k}@${v}`).join(" ")}`)
  }
  if (optionalPeers.length > 0) {
    console.log(
      `optional peers: ${optionalPeers.map(([k]) => k).join(", ")}  (install only if you use them)`,
    )
  }

  if (outcome.envVars.added.length > 0) {
    console.log(`\nenv:  ${outcome.envVars.added.length} key(s) added to ${outcome.envVars.path}`)
    for (const k of outcome.envVars.added) console.log(`  + ${k}`)
  }
  if (outcome.envVars.preserved.length > 0) {
    console.log(
      `env:  preserved existing ${outcome.envVars.preserved.length} key(s) in ${outcome.envVars.path}`,
    )
  }

  if (outcome.warnings.length > 0) {
    console.log("\nwarnings:")
    for (const w of outcome.warnings) console.log(`  ! ${w}`)
  }

  // Per-component setup notes — only for newly-installed components, so
  // re-running `hyper add` doesn't re-spam the user.
  const touched = new Set(outcome.written.map((w) => w.component))
  for (const c of outcome.components) {
    if (!c.docs || !touched.has(c.name)) continue
    console.log(`\n${"-".repeat(60)}`)
    console.log(`# ${c.title ?? c.name}`)
    console.log()
    console.log(c.docs)
  }
}
