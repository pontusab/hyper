/**
 * @hyper/otel — OpenTelemetry-flavored request spans + SLO histograms.
 *
 * The full OTLP exporter is wired via the user's `@opentelemetry/sdk-node`
 * setup (we reuse the global provider). This middleware just emits spans
 * when an `otel.Tracer` is provided, and always pushes duration samples
 * into our built-in SLO recorder.
 */

import type { Middleware } from "@hyper/core"
import { SloRecorder } from "./slo.ts"

export { SloRecorder } from "./slo.ts"
export type { SloTarget } from "./slo.ts"

export interface OtelConfig {
  readonly tracer?: TracerLike
  readonly recorder?: SloRecorder
}

interface SpanLike {
  setAttribute(key: string, value: unknown): void
  setStatus(status: { code: number; message?: string }): void
  end(): void
  recordException?(e: unknown): void
}

interface TracerLike {
  startSpan(name: string, options?: { attributes?: Record<string, unknown> }): SpanLike
}

export function otel(config: OtelConfig = {}): Middleware {
  const recorder = config.recorder ?? new SloRecorder()
  return async ({ req, path, next }) => {
    const span = config.tracer?.startSpan(`${req.method} ${path}`, {
      attributes: {
        "http.method": req.method,
        "http.route": path,
        "http.url": req.url,
      },
    })
    const t0 = performance.now()
    try {
      const out = await next()
      const dt = performance.now() - t0
      recorder.record(path, dt)
      if (span) {
        span.setAttribute("http.duration_ms", dt)
        span.setStatus({ code: 1 })
        span.end()
      }
      return out
    } catch (error) {
      const dt = performance.now() - t0
      recorder.record(path, dt)
      if (span) {
        span.setAttribute("http.duration_ms", dt)
        span.setStatus({ code: 2, message: String(error) })
        span.recordException?.(error)
        span.end()
      }
      throw error
    }
  }
}
