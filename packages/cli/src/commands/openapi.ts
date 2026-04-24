/**
 * `hyper openapi [out]` — emits openapi.json for the current app.
 *
 * Dynamically imports @usehyper/openapi so consumers without it installed
 * don't incur the dependency. Falls back to `app.toOpenAPI()` (core).
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { ParsedArgs } from "../args.ts"
import { isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

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

  let doc: unknown
  try {
    const m = (await import("@usehyper/openapi")) as typeof import("../../../openapi/src/index.ts")
    doc = m.generate(app, {
      ...(typeof args.flags.title === "string" && { title: args.flags.title }),
      ...(typeof args.flags.version === "string" && { version: args.flags.version }),
    })
  } catch {
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
