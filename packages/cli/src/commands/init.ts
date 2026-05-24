/**
 * `hyper init [template]` — scaffold a new Hyper app.
 *
 *   hyper init                 # minimal template into the current dir
 *   hyper init api             # api template
 *   hyper init --dir my-app    # into a subdir
 *   hyper init --no-install    # skip auto `hyper add core`
 *   hyper init --agent-rules   # also install the agent-rules component
 *
 * The template files have NO `@usehyper/*` deps. After files are written
 * we run `hyper add` for each `template.components` entry, which copies the
 * framework source into `<baseDir>/<component>/` and updates the lockfile.
 */

import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { type ParsedArgs, isJson } from "../args.ts"
import { defaultConfig, patchTsConfig, readLock, writeConfig, writeLock } from "../config/index.ts"
import { applyComponents, createRegistryClient } from "../registry/index.ts"
import { TEMPLATES } from "../templates.ts"

export async function runInit(args: ParsedArgs): Promise<number> {
  const templateName = args.positional[0] ?? "minimal"
  const targetDir = typeof args.flags.dir === "string" ? args.flags.dir : "."
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error(
      `unknown template "${templateName}"; available: ${Object.keys(TEMPLATES).join(", ")}`,
    )
    return 2
  }

  const cwd = resolve(process.cwd(), targetDir)
  await mkdir(cwd, { recursive: true })

  const writtenFiles: string[] = []
  for (const [rel, contents] of Object.entries(template.files)) {
    const abs = resolve(cwd, rel)
    if (await pathExists(abs)) continue // never clobber existing files
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, contents)
    writtenFiles.push(abs)
  }

  // Write hyper.config.json + patch tsconfig paths.
  const config = defaultConfig()
  await writeConfig(config, cwd)
  await patchTsConfig(config.alias, config.baseDir, cwd)

  // Auto-install template components (core, optionally log, etc.).
  let componentsInstalled = 0
  let installPeerDeps: Record<string, string> = {}
  if (args.flags["no-install"] !== true) {
    const components = [...template.components]
    if (args.flags["agent-rules"] === true || args.flags["with-agent-rules"] === true) {
      components.push("agent-rules")
    }
    const client = createRegistryClient({ url: config.registryUrl })
    const lock = await readLock(cwd)
    const outcome = await applyComponents(components, {
      cwd,
      config,
      client,
      lock,
      force: false,
      dryRun: false,
    })
    await writeLock(outcome.lock, cwd)
    componentsInstalled = outcome.components.length
    installPeerDeps = outcome.peerDeps as Record<string, string>
  }

  if (isJson(args.flags)) {
    console.log(
      JSON.stringify({
        template: template.name,
        cwd,
        files: writtenFiles,
        componentsInstalled,
      }),
    )
    return 0
  }

  console.log(`initialized "${template.name}" template in ${cwd}`)
  for (const f of writtenFiles) console.log(`  + ${f}`)
  if (componentsInstalled > 0) {
    console.log(`installed ${componentsInstalled} component(s) from ${config.registryUrl}`)
  }

  console.log("\nnext steps:")
  console.log(`  cd ${targetDir === "." ? "." : targetDir}`)
  console.log("  bun install")
  if (Object.keys(installPeerDeps).length > 0) {
    console.log(
      `  bun add ${Object.entries(installPeerDeps)
        .map(([k, v]) => `${k}@${v}`)
        .join(" ")}`,
    )
  }
  console.log("  bun run dev")
  console.log("")
  console.log("  # for AI agents (Cursor / Claude Code), drop in agent rules:")
  console.log("  hyper add agent-rules")
  console.log("")
  console.log("  # for AI tools to discover this registry, point them at:")
  console.log(`  ${config.registryUrl}/mcp`)

  return 0
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}
