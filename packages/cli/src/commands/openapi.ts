/**
 * `hyper openapi [out]` — emits openapi.json for the current app.
 *
 * Dynamically imports @hyper/openapi so consumers without it installed
 * don't incur the dependency. Falls back to `app.toOpenAPI()` (core).
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { ParsedArgs } from "../args.ts"
import { isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp, loadComponentModule } from "../load-app.ts"

export async function runOpenapi(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional.slice(1))
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error("error: entry did not export a Hyper app")
    return 2
  }

  // Prefer the @hyper/openapi component if installed (richer schema converters);
  // fall back to core's built-in projector otherwise.
  let doc: unknown
  const m = await loadComponentModule<typeof import("@hyper/openapi")>("openapi")
  if (m) {
    doc = m.generate(app, {
      ...(typeof args.flags.title === "string" && { title: args.flags.title }),
      ...(typeof args.flags.version === "string" && { version: args.flags.version }),
    })
  } else {
    doc = app.toOpenAPI()
  }

  const out = args.positional[0]
  if (!out) {
    console.log(isJson(args.flags) ? JSON.stringify(doc) : JSON.stringify(doc, null, 2))
    return 0
  }
  const abs = resolve(process.cwd(), out)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`)
  console.log(`wrote ${abs}`)
  return 0
}
