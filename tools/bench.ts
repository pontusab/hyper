#!/usr/bin/env bun
/**
 * CI perf gate — reproducible bench across the example apps.
 *
 * We don't want the runtime of the gate to drift, so we:
 *   1. Pin the entry apps + iteration counts.
 *   2. Invoke `hyper bench` via its exported command function (in-process,
 *      no subprocess overhead).
 *   3. Aggregate JSON reports and compare against DESIGN §12.5 targets
 *      with a 5% slack window.
 *   4. Write reports to bench-reports/ so CI can upload artifacts.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { type BenchReport, runBench } from "../packages/cli/src/commands/bench.ts"

interface Case {
  readonly entry: string
  readonly path: string
  readonly method?: string
  readonly p50: number
  readonly p95: number
}

const CASES: readonly Case[] = [
  { entry: "apps/examples/todo/src/app.ts", path: "/todos", p50: 250, p95: 800 },
  { entry: "apps/examples/ai/src/app.ts", path: "/notes", p50: 300, p95: 900 },
]

async function main(): Promise<number> {
  const reports: BenchReport[] = []
  const failures: string[] = []
  const outDir = resolve(process.cwd(), "bench-reports")
  await mkdir(outDir, { recursive: true })

  for (const c of CASES) {
    const name = c.entry.split("/").slice(-3, -1).join("-")
    const captured = captureConsole()
    const code = await runBench({
      command: "bench",
      positional: [c.entry],
      flags: {
        path: c.path,
        method: c.method ?? "GET",
        n: "10000",
        warmup: "1000",
        p50: String(c.p50),
        p95: String(c.p95),
        json: true,
      },
    })
    const logs = captured.restore()
    const last = logs.filter((l) => l.startsWith("{")).pop()
    if (last) {
      const r = JSON.parse(last) as BenchReport
      reports.push(r)
      await writeFile(resolve(outDir, `${name}.json`), JSON.stringify(r, null, 2))
      const status = r.passed ? "PASS" : "FAIL"
      console.log(
        `[${status}] ${name} ${r.method} ${r.path}  p50=${r.p50_us}µs p95=${r.p95_us}µs rps=${r.rps}`,
      )
      if (!r.passed)
        failures.push(
          `${name}: p50 ${r.p50_us}µs > ${r.targetP50Us}µs (5% slack) or p95 over ${r.targetP95Us}µs`,
        )
    } else if (code !== 0) {
      failures.push(`${name}: bench exited ${code}`)
    }
  }

  await writeFile(resolve(outDir, "index.json"), JSON.stringify({ reports }, null, 2))
  if (failures.length > 0) {
    console.error("\nPerf gate FAILED:")
    for (const f of failures) console.error(`  - ${f}`)
    return 1
  }
  console.log(`\n${reports.length} scenario(s) passed the perf gate.`)
  return 0
}

function captureConsole(): { restore: () => string[] } {
  const logs: string[] = []
  const orig = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }
  return {
    restore: () => {
      console.log = orig
      return logs
    },
  }
}

main().then((code) => process.exit(code))
