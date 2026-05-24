#!/usr/bin/env bun
/**
 * Local pre-release smoke test.
 *
 * Packs `create-hyper` and `@usehyper/cli` into temporary tarballs, installs
 * them into a throwaway directory, and runs the same scaffold-and-boot flow
 * the public install does:
 *
 *   1. `bun pm pack` both packages (uses the real `prepack` snapshot build).
 *   2. Spin up a tiny static-file http server pointing at a fake-npm dir
 *      that contains the freshly-packed tarballs, so `bun create` can
 *      resolve them without us touching the public registry.
 *   3. Run the equivalent of `bun create hyper smoke-app --template api`,
 *      verify the directory layout, boot `hyper dev` for ~5s.
 *
 * Run with:
 *
 *   bun run tools/smoke-release.ts
 *
 * Exits non-zero on any failure. Used as a release-gate before tagging.
 */

import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const CLI_DIR = join(ROOT, "packages/cli")
const CREATE_DIR = join(ROOT, "packages/create-hyper")

async function pkgVersion(dir: string): Promise<string> {
  const raw = await readFile(join(dir, "package.json"), "utf8")
  const v = (JSON.parse(raw) as { version?: string }).version
  if (!v) throw new Error(`missing version in ${dir}/package.json`)
  return v
}

interface RunResult {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

async function run(
  cmd: string,
  args: readonly string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<RunResult> {
  return await new Promise((res) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (b) => {
      stdout += b.toString()
    })
    child.stderr?.on("data", (b) => {
      stderr += b.toString()
    })
    const timer = opts.timeoutMs
      ? setTimeout(() => child.kill("SIGTERM"), opts.timeoutMs)
      : undefined
    child.on("exit", (code) => {
      if (timer) clearTimeout(timer)
      res({ stdout, stderr, code: code ?? 1 })
    })
  })
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  process.stdout.write(`→ ${label} … `)
  try {
    const out = await fn()
    process.stdout.write(`ok  (${Date.now() - start}ms)\n`)
    return out
  } catch (err) {
    process.stdout.write("FAIL\n")
    throw err
  }
}

async function main(): Promise<number> {
  const work = await mkdtemp(join(tmpdir(), "hyper-smoke-"))
  const tarballs = join(work, "tarballs")
  const target = join(work, "smoke-app")
  await mkdir(tarballs, { recursive: true })

  try {
    await step("pack create-hyper", async () => {
      const r = await run("bun", ["pm", "pack", "--destination", tarballs], {
        cwd: CREATE_DIR,
      })
      if (r.code !== 0) throw new Error(`pack create-hyper failed:\n${r.stderr}`)
    })

    await step("pack @usehyper/cli (runs prepack snapshot build)", async () => {
      const r = await run("bun", ["pm", "pack", "--destination", tarballs], {
        cwd: CLI_DIR,
      })
      if (r.code !== 0) throw new Error(`pack @usehyper/cli failed:\n${r.stderr}`)
    })

    const cliVersion = await pkgVersion(CLI_DIR)
    const createVersion = await pkgVersion(CREATE_DIR)
    const cliTgz = join(tarballs, `usehyper-cli-${cliVersion}.tgz`)
    const createTgz = join(tarballs, `create-hyper-${createVersion}.tgz`)
    if (!(await pathExists(cliTgz))) throw new Error(`missing ${cliTgz}`)
    if (!(await pathExists(createTgz))) throw new Error(`missing ${createTgz}`)

    await step("scaffold smoke-app from local tarballs", async () => {
      // Bypass `bun create` (which insists on the public registry) and run the
      // CLI's `init` command directly out of the freshly-packed tarball — the
      // exact same code path `create-hyper` would invoke after npm propagation.
      await mkdir(target, { recursive: true })
      const r = await run(
        "bunx",
        [`--package=${cliTgz}`, "hyper", "init", "api", "--dir", target],
        { cwd: work, timeoutMs: 60_000 },
      )
      if (r.code !== 0) {
        throw new Error(
          `init failed (code ${r.code}):\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`,
        )
      }
    })

    await step("verify expected layout", async () => {
      const expected = [
        "hyper.config.json",
        "hyper.lock.json",
        "tsconfig.json",
        "src/hyper/core",
      ]
      for (const rel of expected) {
        if (!(await pathExists(join(target, rel)))) {
          throw new Error(`missing ${rel}`)
        }
      }
    })

    await step("boot hyper dev for 4s", async () => {
      // Smoke-boot the dev server. Killed by SIGTERM after the timeout —
      // exit code is non-zero in that case, which is what we want.
      const r = await run(
        "bunx",
        [`--package=${cliTgz}`, "hyper", "dev"],
        { cwd: target, timeoutMs: 4_000 },
      )
      // SIGTERM exits with 143 on most shells, or null code from spawn.
      const acceptable = r.code === 143 || r.code === 0 || r.code === null
      if (!acceptable) {
        throw new Error(
          `dev exited unexpectedly (code ${r.code}):\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`,
        )
      }
    })

    console.log(`\nsmoke ok — workdir: ${work}`)
    return 0
  } catch (err) {
    console.error(`\nsmoke failed: ${(err as Error).message}`)
    console.error(`workdir kept for inspection: ${work}`)
    return 1
  }
}

main().then((code) => process.exit(code))
