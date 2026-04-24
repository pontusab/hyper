/**
 * `hyper bench` — minimal, reproducible latency benchmark.
 *
 *   hyper bench                   → bench/<entry> and print stats
 *   hyper bench --json            → emit JSON (CI perf gate)
 *   hyper bench --path /todos     → pick a route to hammer
 *
 * We run everything in-process via app.fetch — no sockets, no port
 * contention, no kernel scheduler noise. That gives us a stable signal
 * for regression detection. The runner is warmup-aware and records
 * allocation deltas so we can spot memory regressions.
 */

import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

export interface BenchReport {
  readonly path: string
  readonly method: string
  readonly iterations: number
  readonly warmup: number
  readonly p50_us: number
  readonly p95_us: number
  readonly p99_us: number
  readonly rps: number
  readonly heapUsedDeltaMb: number
  readonly targetP50Us: number
  readonly targetP95Us: number
  readonly passed: boolean
}

export async function runBench(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error("error: entry did not export a Hyper app")
    return 2
  }
  const iterations = readNumber(args.flags.n, 20_000)
  const warmup = readNumber(args.flags.warmup, 2_000)
  const targetP50 = readNumber(args.flags.p50, 250)
  const targetP95 = readNumber(args.flags.p95, 800)

  if (args.flags.tests === true) {
    const reports: BenchReport[] = []
    for (const r of app.routeList) {
      if (r.path.includes(":")) continue
      const report = await benchOne(app, r.path, r.method, {
        iterations: Math.max(1_000, Math.floor(iterations / Math.max(1, app.routeList.length))),
        warmup: Math.max(100, Math.floor(warmup / 2)),
        targetP50,
        targetP95,
      })
      reports.push(report)
    }
    const passed = reports.every((r) => r.passed)
    if (isJson(args.flags)) {
      console.log(JSON.stringify({ passed, routes: reports }))
    } else {
      console.log(`bench --tests  ${reports.length} route(s)  ${passed ? "PASS" : "FAIL"}`)
      for (const r of reports) {
        console.log(
          `  ${r.passed ? "PASS" : "FAIL"}  ${r.method.padEnd(6)} ${r.path.padEnd(30)} p50=${r.p50_us}µs p95=${r.p95_us}µs rps=${r.rps}`,
        )
      }
    }
    return passed ? 0 : 1
  }

  const path = typeof args.flags.path === "string" ? args.flags.path : "/"
  const method = typeof args.flags.method === "string" ? args.flags.method.toUpperCase() : "GET"
  const url = `http://local${path}`

  // Warmup.
  for (let i = 0; i < warmup; i++) await app.fetch(new Request(url, { method }))

  const samples = new Float64Array(iterations)
  const start = process.memoryUsage().heapUsed
  const t0 = Bun.nanoseconds()
  for (let i = 0; i < iterations; i++) {
    const s = Bun.nanoseconds()
    await app.fetch(new Request(url, { method }))
    samples[i] = (Bun.nanoseconds() - s) / 1000 // µs
  }
  const t1 = Bun.nanoseconds()
  const heapUsedDelta = process.memoryUsage().heapUsed - start
  const sorted = samples.slice().sort()
  const p50 = percentile(sorted, 0.5)
  const p95 = percentile(sorted, 0.95)
  const p99 = percentile(sorted, 0.99)
  const rps = iterations / ((t1 - t0) / 1_000_000_000)
  const passed = p50 <= targetP50 * 1.05 && p95 <= targetP95 * 1.05
  const report: BenchReport = {
    path,
    method,
    iterations,
    warmup,
    p50_us: round(p50),
    p95_us: round(p95),
    p99_us: round(p99),
    rps: round(rps),
    heapUsedDeltaMb: round(heapUsedDelta / 1024 / 1024),
    targetP50Us: targetP50,
    targetP95Us: targetP95,
    passed,
  }
  if (isJson(args.flags)) {
    console.log(JSON.stringify(report))
  } else {
    console.log(`route        ${method} ${path}`)
    console.log(`iters        ${iterations} (warmup ${warmup})`)
    console.log(`p50/p95/p99  ${report.p50_us}µs / ${report.p95_us}µs / ${report.p99_us}µs`)
    console.log(`rps          ${report.rps}`)
    console.log(`heapΔ        ${report.heapUsedDeltaMb} MB`)
    console.log(`target       p50<=${targetP50}µs p95<=${targetP95}µs (5% slack)`)
    console.log(`status       ${passed ? "PASS" : "FAIL"}`)
  }
  return passed ? 0 : 1
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx] ?? 0
}
function round(n: number): number {
  return Math.round(n * 100) / 100
}
function readNumber(flag: string | boolean | undefined, fallback: number): number {
  if (typeof flag === "string") {
    const n = Number.parseInt(flag, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  return fallback
}

async function benchOne(
  app: NonNullable<Awaited<ReturnType<typeof loadApp>>>,
  path: string,
  method: string,
  opts: {
    readonly iterations: number
    readonly warmup: number
    readonly targetP50: number
    readonly targetP95: number
  },
): Promise<BenchReport> {
  const url = `http://local${path}`
  for (let i = 0; i < opts.warmup; i++) await app.fetch(new Request(url, { method }))
  const samples = new Float64Array(opts.iterations)
  const start = process.memoryUsage().heapUsed
  const t0 = Bun.nanoseconds()
  for (let i = 0; i < opts.iterations; i++) {
    const s = Bun.nanoseconds()
    await app.fetch(new Request(url, { method }))
    samples[i] = (Bun.nanoseconds() - s) / 1000
  }
  const t1 = Bun.nanoseconds()
  const heapUsedDelta = process.memoryUsage().heapUsed - start
  const sorted = samples.slice().sort()
  const p50 = percentile(sorted, 0.5)
  const p95 = percentile(sorted, 0.95)
  const p99 = percentile(sorted, 0.99)
  const rps = opts.iterations / ((t1 - t0) / 1_000_000_000)
  const passed = p50 <= opts.targetP50 * 1.05 && p95 <= opts.targetP95 * 1.05
  return {
    path,
    method,
    iterations: opts.iterations,
    warmup: opts.warmup,
    p50_us: round(p50),
    p95_us: round(p95),
    p99_us: round(p99),
    rps: round(rps),
    heapUsedDeltaMb: round(heapUsedDelta / 1024 / 1024),
    targetP50Us: opts.targetP50,
    targetP95Us: opts.targetP95,
    passed,
  }
}
