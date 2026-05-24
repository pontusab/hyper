/**
 * `hyper init [template]` — scaffold a new Hyper app.
 *
 *   hyper init                 # minimal template into the current dir
 *   hyper init api             # api template
 *   hyper init --dir my-app    # into a subdir
 *   hyper init --no-components # skip auto `hyper add core`
 *   hyper init --no-install    # skip `bun install` after scaffolding
 *   hyper init --agent-rules   # also install the agent-rules component
 *
 * The template files have NO `@hyper/*` runtime deps — imports use
 * `@hyper/core` and resolve to vendored source under `src/hyper/<name>/` via
 * tsconfig paths.
 *
 * Flow:
 *   1. Write template files into the target dir (with `@usehyper/cli` pinned
 *      to the running CLI's version in devDependencies).
 *   2. Run the registry applier — copies component source into the project
 *      and aggregates peer-dep declarations.
 *   3. Merge any peer deps into `package.json`.
 *   4. Run `bun install` so `node_modules/.bin/hyper` is available
 *      immediately.
 */

import { spawn } from "node:child_process"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { type ParsedArgs, isJson } from "../args.ts"
import { printBanner } from "../banner.ts"
import { defaultConfig, patchTsConfig, readLock, writeConfig, writeLock } from "../config/index.ts"
import { applyComponents, createRegistryClient } from "../registry/index.ts"
import { TEMPLATES } from "../templates.ts"

/**
 * The CLI's own version. Used to pin `@usehyper/cli` in scaffolded
 * `package.json` files. Resolved at runtime so we don't drift if the bin
 * is invoked from a workspace where the package.json on disk is newer than
 * the constants frozen into a build.
 */
async function readOwnVersion(): Promise<string> {
  try {
    const url = new URL("../../package.json", import.meta.url)
    const raw = await readFile(url, "utf8")
    const v = (JSON.parse(raw) as { version?: string }).version
    if (typeof v === "string" && v.length > 0) return v
  } catch {}
  return "latest"
}

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

  const cliVersion = await readOwnVersion()
  printBanner(cliVersion, { json: isJson(args.flags) })

  const writtenFiles: string[] = []
  for (const [rel, contents] of Object.entries(template.files)) {
    const abs = resolve(cwd, rel)
    if (await pathExists(abs)) continue // never clobber existing files
    await mkdir(dirname(abs), { recursive: true })
    const final = contents.replaceAll("__HYPER_CLI_VERSION__", cliVersion)
    await writeFile(abs, final)
    writtenFiles.push(abs)
  }

  const config = defaultConfig()
  await writeConfig(config, cwd)
  await patchTsConfig(config.alias, config.baseDir, cwd)

  // Auto-install template components (core, optionally log, etc.).
  let componentsInstalled = 0
  let installPeerDeps: Record<string, string> = {}
  if (args.flags["no-components"] !== true) {
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

  if (Object.keys(installPeerDeps).length > 0) {
    await mergePackageJsonDeps(cwd, installPeerDeps)
  }

  let installRan = false
  if (args.flags["no-install"] !== true) {
    installRan = await runBunInstall(cwd)
  }

  if (isJson(args.flags)) {
    console.log(
      JSON.stringify({
        template: template.name,
        cwd,
        files: writtenFiles,
        componentsInstalled,
        installRan,
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
  if (!installRan) console.log("  bun install")
  console.log("  bun run dev")
  console.log("")
  console.log("  # for AI agents (Cursor / Claude Code), drop in agent rules:")
  console.log("  bunx hyper add agent-rules")
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

/**
 * Merge peer-deps declared by registry components into the scaffolded
 * `package.json`. Existing keys win — we never downgrade or override what
 * the user already specified.
 */
async function mergePackageJsonDeps(
  cwd: string,
  peerDeps: Readonly<Record<string, string>>,
): Promise<void> {
  const path = resolve(cwd, "package.json")
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch {
    return
  }
  const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> }
  const merged = { ...peerDeps, ...(pkg.dependencies ?? {}) }
  pkg.dependencies = merged
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

/**
 * Spawn `bun install` in the project dir. Returns true on success. Errors
 * are logged but don't abort the scaffold — the user can always retry the
 * install manually.
 */
async function runBunInstall(cwd: string): Promise<boolean> {
  process.stdout.write("\nrunning `bun install`…\n")
  return await new Promise<boolean>((res) => {
    const child = spawn("bun", ["install"], { cwd, stdio: "inherit" })
    child.on("error", (err) => {
      console.error(`warning: bun install failed to start (${err.message})`)
      res(false)
    })
    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(`warning: \`bun install\` exited with code ${code ?? "?"}; run it manually.`)
        res(false)
        return
      }
      res(true)
    })
  })
}
