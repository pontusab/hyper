#!/usr/bin/env bun
/**
 * One-shot: rewrite the `## Install` block in every component README to
 * reflect the registry workflow (no `bun add @hyper/*` — components are
 * installed as source via the CLI).
 *
 * Run: `bun run tools/fix-readme-install.ts`
 */
import { readdir } from "node:fs/promises"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const PACKAGES = join(ROOT, "packages")

// Skip these — they ship on npm as real packages, not as registry components.
const NPM_PACKAGES = new Set(["cli", "create-hyper"])

const PATTERN = /## Install\n\n```bash\nbun add @hyper\/([a-z0-9-]+)\n```/

function replacement(component: string): string {
  return `## Install

Components are installed as source into your repo, not pulled from npm:

\`\`\`bash
bunx hyper add ${component}
\`\`\`

Wires the alias \`@hyper/${component}\` to \`src/hyper/${component}/\` (configurable in \`hyper.config.json\`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.`
}

async function main(): Promise<number> {
  const entries = await readdir(PACKAGES, { withFileTypes: true })
  let touched = 0
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (NPM_PACKAGES.has(e.name)) continue
    const readme = join(PACKAGES, e.name, "README.md")
    const file = Bun.file(readme)
    if (!(await file.exists())) continue
    const text = await file.text()
    const m = text.match(PATTERN)
    if (!m) {
      process.stderr.write(`skip: ${e.name} (no matching install block)\n`)
      continue
    }
    const next = text.replace(PATTERN, replacement(m[1] ?? e.name))
    if (next !== text) {
      await Bun.write(readme, next)
      touched++
      process.stdout.write(`updated packages/${e.name}/README.md\n`)
    }
  }
  process.stdout.write(`\n${touched} README(s) rewritten\n`)
  return 0
}

main().then((c) => process.exit(c))
