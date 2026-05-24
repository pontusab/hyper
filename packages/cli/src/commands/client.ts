/**
 * `hyper client <outDir> [entry]` — emits client.ts + client.d.ts from the
 * app's `toClientManifest()`. Codegen lives in @hyper/client; the CLI is
 * responsible for loading the app and writing files.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { type ParsedArgs, isJson } from "../args.ts"
import { readConfig } from "../config/index.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

export async function runClient(args: ParsedArgs): Promise<number> {
  const outDir = args.positional[0]
  if (!outDir) {
    console.error("usage: hyper client <outDir> [entry]")
    return 2
  }
  const entryArg = args.positional[1] ? [args.positional[1]] : []
  const entry = await resolveEntry(entryArg)
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error(`error: no default/named 'app' export in ${entry}`)
    return 2
  }

  // The codegen lives at <baseDir>/client/codegen.ts after `hyper add client`.
  // We resolve it locally first, with @hyper/client and @hyper/client as fallbacks.
  const config = await readConfig()
  const local = resolve(process.cwd(), config.baseDir, "client/codegen.ts")
  let mod: typeof import("@hyper/client/codegen") | null = null
  for (const spec of [local, "@hyper/client/codegen", "@hyper/client/codegen"]) {
    try {
      mod = (await import(spec)) as typeof import("@hyper/client/codegen")
      break
    } catch {
      // try next
    }
  }
  if (!mod) {
    console.error(
      "error: @hyper/client not installed in this project. Run `hyper add client` first.",
    )
    return 2
  }
  const baseUrl = typeof args.flags.baseUrl === "string" ? args.flags.baseUrl : ""
  const result = mod.generateClient({
    manifest: app.toClientManifest(),
    baseUrl,
    rootName: typeof args.flags.name === "string" ? args.flags.name : "api",
    resultTypes: args.flags.resultTypes === true || args.flags["result-types"] === true,
  })

  const abs = resolve(process.cwd(), outDir)
  await mkdir(abs, { recursive: true })
  const runtimePath = resolve(abs, "client.ts")
  const dtsPath = resolve(abs, "client.d.ts")
  await writeFile(runtimePath, result.runtime)
  await writeFile(dtsPath, result.declaration)

  const summary = {
    runtime: runtimePath,
    declaration: dtsPath,
    routeCount: app.routeList.length,
  }
  if (isJson(args.flags)) {
    console.log(JSON.stringify(summary))
  } else {
    console.log(`client emitted -> ${abs}`)
    console.log(`  ${summary.routeCount} route(s)`)
  }
  return 0
}
