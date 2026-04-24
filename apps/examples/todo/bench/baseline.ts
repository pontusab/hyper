/**
 * Bench baseline — in-process fetch loop for /todos GET and POST.
 * Writes JSON to stdout (pipeable to CI perf history). Not gated yet.
 */

import a from "../src/app.ts"

interface Result {
  readonly label: string
  readonly iterations: number
  readonly totalMs: number
  readonly opsPerSec: number
  readonly p50Us: number
  readonly p99Us: number
}

async function runOne(label: string, factory: () => Request, iters: number): Promise<Result> {
  // warmup
  for (let i = 0; i < Math.min(1_000, iters); i++) await a.fetch(factory())
  const samples = new Float64Array(iters)
  const startAll = performance.now()
  for (let i = 0; i < iters; i++) {
    const s = performance.now()
    await a.fetch(factory())
    samples[i] = (performance.now() - s) * 1000 // µs
  }
  const totalMs = performance.now() - startAll
  samples.sort()
  const p = (q: number): number => samples[Math.min(iters - 1, Math.floor(iters * q))] ?? 0
  return {
    label,
    iterations: iters,
    totalMs,
    opsPerSec: Math.round((iters / totalMs) * 1000),
    p50Us: p(0.5),
    p99Us: p(0.99),
  }
}

async function main(): Promise<void> {
  const iters = Number(process.env.ITERS ?? 20_000)

  const results: Result[] = []
  results.push(await runOne("GET /health", () => new Request("http://localhost/health"), iters))
  results.push(
    await runOne(
      "POST /todos (body+validate)",
      () =>
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "bench" }),
        }),
      iters,
    ),
  )

  const report = {
    runtime: `bun ${Bun.version}`,
    platform: `${process.platform}-${process.arch}`,
    ts: new Date().toISOString(),
    results,
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
