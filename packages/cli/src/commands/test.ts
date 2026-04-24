/**
 * `hyper test` — runs `.example()` contracts + `bun:test` + optional
 * typecheck + fuzz harness.
 *
 * Order:
 *   1. example contracts (fast, surface DX regressions first)
 *   2. bun:test (unit + integration)
 *   3. optional --types (tsgo) and --fuzz (per-route attack corpus)
 *
 * Non-zero exit if any stage fails. `--reporter=junit` writes a JUnit
 * XML file to `./test-report.xml` for CI.
 */

import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

export async function runTest(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const reporter = typeof args.flags.reporter === "string" ? args.flags.reporter : undefined
  const runFuzz = args.flags.fuzz === true
  const runTypes = args.flags.types === true
  const junitPath = typeof args.flags.junit === "string" ? args.flags.junit : "./test-report.xml"

  const testResults: Array<{
    suite: string
    name: string
    ok: boolean
    error?: string
    time: number
  }> = []

  const app = await loadApp(entry)
  if (app) {
    const core = (await import("@hyper/core")) as typeof import("../../../core/src/index.ts")
    const t0 = performance.now()
    const results = await core.runExamples(app)
    const failing = results.filter((r) => !r.ok)
    for (const r of results) {
      testResults.push({
        suite: "examples",
        name: `${r.method} ${r.route} — ${r.example}`,
        ok: r.ok,
        ...(r.error !== undefined && { error: r.error }),
        time: 0,
      })
    }
    if (isJson(args.flags)) {
      console.log(JSON.stringify({ examples: results }))
    } else if (results.length > 0) {
      console.log(
        `examples: ${results.length - failing.length}/${results.length} passing  (${(performance.now() - t0).toFixed(1)}ms)`,
      )
      for (const f of failing) {
        console.log(`  FAIL  ${f.method} ${f.route}  "${f.example}"  status=${f.status}`)
        if (f.error) console.log(`        ${f.error}`)
      }
    }
    if (failing.length > 0) return 1

    if (runFuzz) {
      // biome-ignore format: keep single-line for tsgo
      const fuzz = (await import("@hyper/testing/fuzz")) as typeof import("../../../testing/src/fuzz.ts")
      const reports: string[] = []
      let totalFailed = 0
      for (const r of app.routeList) {
        const entry = `${r.method} ${r.path}` as Parameters<typeof fuzz.fuzzRoute>[1]
        const report = await fuzz.fuzzRoute(app, entry)
        if (!report.ok) {
          totalFailed += report.failed.length
          reports.push(`FAIL ${r.method} ${r.path}: ${report.failed.length} case(s)`)
          for (const f of report.failed) {
            reports.push(`    ${f.case} (status=${f.status})`)
            testResults.push({
              suite: "fuzz",
              name: `${r.method} ${r.path} :: ${f.case}`,
              ok: false,
              error: `status=${f.status}${f.error ? ` error=${f.error}` : ""}`,
              time: 0,
            })
          }
        } else {
          testResults.push({
            suite: "fuzz",
            name: `${r.method} ${r.path}`,
            ok: true,
            time: 0,
          })
        }
      }
      if (reports.length > 0) {
        console.log(reports.join("\n"))
      } else {
        console.log("fuzz: all routes clean")
      }
      if (totalFailed > 0) return 1
    }
  }

  if (runTypes) {
    const code = await runSpawn("tsgo", ["--noEmit", "-p", "tsconfig.json"])
    if (code !== 0) {
      const fallback = await runSpawn("bunx", ["tsc", "--noEmit", "-p", "tsconfig.json"])
      if (fallback !== 0) return fallback
    }
  }

  const bunCode = await runSpawn("bun", ["test"])

  if (reporter === "junit") {
    await writeFile(junitPath, toJunit(testResults))
    if (!isJson(args.flags)) console.log(`junit report -> ${junitPath}`)
  }

  return bunCode
}

function runSpawn(cmd: string, args: readonly string[]): Promise<number> {
  return new Promise<number>((res) => {
    const child = spawn(cmd, [...args], { stdio: "inherit" })
    child.on("exit", (code) => res(code ?? 1))
    child.on("error", () => res(1))
  })
}

function toJunit(
  results: ReadonlyArray<{
    suite: string
    name: string
    ok: boolean
    error?: string
    time: number
  }>,
): string {
  const bySuite = new Map<string, typeof results>()
  for (const r of results) {
    const list = (bySuite.get(r.suite) ?? []) as typeof results
    bySuite.set(r.suite, [...list, r] as typeof results)
  }
  const suites: string[] = []
  for (const [name, rs] of bySuite) {
    const failures = rs.filter((r) => !r.ok).length
    const cases = rs
      .map((r) => {
        const open = `<testcase classname="${escapeXml(name)}" name="${escapeXml(r.name)}" time="${(r.time / 1000).toFixed(3)}">`
        if (r.ok) return `${open}</testcase>`
        return `${open}<failure message="${escapeXml(r.error ?? "failed")}" /></testcase>`
      })
      .join("\n")
    suites.push(
      `  <testsuite name="${escapeXml(name)}" tests="${rs.length}" failures="${failures}">\n${cases}\n  </testsuite>`,
    )
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n${suites.join("\n")}\n</testsuites>\n`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
