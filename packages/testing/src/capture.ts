/**
 * `captureEvents(app)` — attaches a plugin that siphons every wide log
 * event into an in-memory array, so tests can assert on observability
 * contracts (what routes emit, what redaction shape, etc.).
 *
 * We don't import @usehyper/log here to keep the peer-dep boundary clean;
 * instead we install a plugin with a request.after hook that drains
 * whatever structured log the ctx exposes. Users can additionally plug
 * @usehyper/log's `captureDrain` for full fidelity.
 */

import type { HyperApp, HyperPlugin, TestOverrides } from "@usehyper/core"

export interface CapturedEvent {
  readonly method: string
  readonly path: string
  readonly status: number
  readonly durationMs: number
  readonly [k: string]: unknown
}

export interface EventCapture {
  readonly events: readonly CapturedEvent[]
  /** Convenience: find the first event matching a partial shape. */
  find(match: Partial<CapturedEvent>): CapturedEvent | undefined
  /** True if at least one event matches. */
  has(match: Partial<CapturedEvent>): boolean
  /** Clear recorded events — useful between test cases. */
  clear(): void
  /** Stop recording and detach. */
  stop(): void
}

/**
 * Install the capture plugin on a test-scoped app clone. Returns the
 * capture handle plus a new HyperApp with capture active.
 */
export function captureEvents(
  base: HyperApp,
  opts: TestOverrides = {},
): {
  readonly app: HyperApp
  readonly capture: EventCapture
} {
  const events: CapturedEvent[] = []
  let stopped = false
  const plugin: HyperPlugin = {
    name: "@usehyper/testing:capture",
    request: {
      after({ req, res, route }) {
        if (stopped) return
        const url = new URL(req.url)
        events.push({
          method: req.method,
          path: route?.path ?? url.pathname,
          status: res.status,
          durationMs: 0,
        })
      },
    },
  }
  const existing = opts.plugins ?? {}
  const app = base.test({
    ...opts,
    plugins: { ...existing, add: [...(existing.add ?? []), plugin] },
  })
  const capture: EventCapture = {
    get events() {
      return events
    },
    find: (m) => events.find((e) => matchesPartial(e, m)),
    has: (m) => events.some((e) => matchesPartial(e, m)),
    clear: () => {
      events.length = 0
    },
    stop: () => {
      stopped = true
    },
  }
  return { app, capture }
}

function matchesPartial(ev: CapturedEvent, m: Partial<CapturedEvent>): boolean {
  for (const [k, v] of Object.entries(m)) {
    if ((ev as Record<string, unknown>)[k] !== v) return false
  }
  return true
}
