/**
 * SLO histogram recorder + `.slo()` route builder sugar.
 *
 * `.slo({ p99: 200 })` attaches `{ slo: { p99: 200 } }` to `meta`; the
 * `otelPlugin` middleware uses it to produce a per-route histogram and
 * tags spans with `slo.target` / `slo.violation=true`.
 */

export interface SloTarget {
  readonly p50?: number
  readonly p95?: number
  readonly p99?: number
}

interface Sample {
  readonly durationMs: number
  readonly route: string
}

export class SloRecorder {
  #samples: Sample[] = []

  record(route: string, durationMs: number): void {
    this.#samples.push({ route, durationMs })
    if (this.#samples.length > 10_000) this.#samples.shift()
  }

  percentile(route: string, p: number): number {
    const xs = this.#samples
      .filter((s) => s.route === route)
      .map((s) => s.durationMs)
      .sort((a, b) => a - b)
    if (xs.length === 0) return 0
    const idx = Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))
    return xs[idx] ?? 0
  }

  snapshot(): Record<string, { p50: number; p95: number; p99: number; count: number }> {
    const byRoute = new Map<string, number[]>()
    for (const s of this.#samples) {
      const arr = byRoute.get(s.route) ?? []
      arr.push(s.durationMs)
      byRoute.set(s.route, arr)
    }
    const out: Record<string, { p50: number; p95: number; p99: number; count: number }> = {}
    for (const [route, xs] of byRoute) {
      xs.sort((a, b) => a - b)
      const at = (p: number) => xs[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))] ?? 0
      out[route] = { p50: at(50), p95: at(95), p99: at(99), count: xs.length }
    }
    return out
  }
}
