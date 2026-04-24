import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { type ParsedArgs, isJson } from "../args.ts"
import { TEMPLATES } from "../templates.ts"

export async function runInit(args: ParsedArgs): Promise<number> {
  const templateName = args.positional[0] ?? "minimal"
  const target = typeof args.flags.dir === "string" ? args.flags.dir : "."
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error(
      `unknown template "${templateName}"; available: ${Object.keys(TEMPLATES).join(", ")}`,
    )
    return 2
  }

  const written: string[] = []
  for (const [rel, contents] of Object.entries(template.files)) {
    const abs = resolve(process.cwd(), target, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, contents)
    written.push(abs)
  }

  if (isJson(args.flags)) {
    console.log(JSON.stringify({ template: template.name, written }))
  } else {
    console.log(`initialized "${template.name}" template:`)
    for (const f of written) console.log(`  ${f}`)
    console.log("\nnext steps:")
    console.log("  bun install")
    console.log("  bun run dev")
  }
  return 0
}
