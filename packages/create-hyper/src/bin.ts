#!/usr/bin/env bun
/**
 * `bun create hyper <name>` — thin shim that delegates to `@usehyper/cli`'s
 * `init` command. The CLI is the source of truth for templates, registry
 * resolution, and tsconfig patching.
 *
 *   bun create hyper my-app
 *   bun create hyper my-app --template api
 *   bun create hyper my-app --agent-rules
 *
 * Implementation:
 *   1. Parse the project name + flags.
 *   2. mkdir the target.
 *   3. spawn `bunx @usehyper/cli init <template> --dir <name>`, forwarding flags.
 *
 * No source duplication — when the CLI gains a new template, this shim picks
 * it up automatically.
 */

import { spawn } from "node:child_process"
import { mkdir, readdir } from "node:fs/promises"
import { resolve } from "node:path"

interface Argv {
  readonly name: string | undefined
  readonly template: string
  readonly force: boolean
  readonly help: boolean
  readonly extraArgs: readonly string[]
}

function parse(argv: readonly string[]): Argv {
  const positional: string[] = []
  const extraArgs: string[] = []
  let template = "minimal"
  let force = false
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === "--help" || a === "-h") {
      help = true
      continue
    }
    if (a === "--force") {
      force = true
      continue
    }
    if (a === "--template") {
      template = argv[++i] ?? template
      continue
    }
    if (a.startsWith("--template=")) {
      template = a.slice("--template=".length)
      continue
    }
    if (a.startsWith("--")) {
      extraArgs.push(a)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("-")) {
        extraArgs.push(next)
        i++
      }
      continue
    }
    positional.push(a)
  }
  return { name: positional[0], template, force, help, extraArgs }
}

async function main(): Promise<number> {
  const args = parse(process.argv.slice(2))
  if (args.help || !args.name) {
    console.log("usage: bun create hyper <name> [--template minimal|api] [--agent-rules]")
    console.log()
    console.log("Equivalent to: bunx @usehyper/cli init <template> --dir <name>")
    return args.help ? 0 : 2
  }
  const dir = resolve(process.cwd(), args.name)
  await mkdir(dir, { recursive: true })
  const existing = await readdir(dir).catch(() => [])
  if (existing.length > 0 && !args.force) {
    console.error(`error: ${dir} is not empty. Pass --force to overwrite.`)
    return 1
  }

  const cliArgs = ["@usehyper/cli", "init", args.template, "--dir", dir, ...args.extraArgs]
  return await new Promise<number>((res) => {
    const child = spawn("bunx", cliArgs, { stdio: "inherit" })
    child.on("exit", (code) => res(code ?? 1))
    child.on("error", (err) => {
      console.error(`error: failed to run @usehyper/cli init — ${err.message}`)
      res(1)
    })
  })
}

main().then((code) => process.exit(code))
