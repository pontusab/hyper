/**
 * LogBuilder — one per request by default. Collects wide-event fields
 * and emits exactly one event when `finish()` is called.
 *
 * Child builders emit their own events but inherit parent fields.
 */

import type { LogBuilder, LogDrain, LogEvent, LogLevel } from "./types.ts"

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

export interface BuilderOptions {
  readonly drains: readonly LogDrain[]
  readonly minLevel: LogLevel
  readonly clock: () => number
  readonly render: (event: LogEvent) => LogEvent
  readonly sample: (event: LogEvent) => boolean
  readonly parentFields?: Record<string, unknown>
  readonly scope?: string
}

export function createLogBuilder(opts: BuilderOptions): LogBuilder {
  const fields: Record<string, unknown> = { ...(opts.parentFields ?? {}) }
  let hintLevel: LogLevel = "info"
  let finished = false
  if (opts.scope) fields.scope = opts.scope

  const emit = (msg: string | undefined): void => {
    if (finished) return
    finished = true
    const level = hintLevel
    if (LEVEL_ORDER[level] < LEVEL_ORDER[opts.minLevel]) return
    const event: LogEvent = opts.render({
      ts: new Date(opts.clock()).toISOString(),
      level,
      ...(msg !== undefined ? { msg } : {}),
      ...fields,
    })
    if (!opts.sample(event)) return
    for (const d of opts.drains) {
      try {
        const p = d.write(event)
        if (p && typeof (p as Promise<void>).catch === "function") {
          ;(p as Promise<void>).catch(() => {
            // Swallow drain errors to protect the request path.
          })
        }
      } catch {
        // Drains must not break the request pipeline.
      }
    }
  }

  const builder: LogBuilder = {
    set(f) {
      Object.assign(fields, f)
      return builder
    },
    level(l) {
      hintLevel = l
      return builder
    },
    child(scope) {
      return createLogBuilder({
        drains: opts.drains,
        minLevel: opts.minLevel,
        clock: opts.clock,
        render: opts.render,
        sample: opts.sample,
        parentFields: { ...fields },
        scope,
      })
    },
    finish(msg) {
      emit(msg)
    },
    info(msg, f) {
      if (f) Object.assign(fields, f)
      hintLevel = "info"
      emit(msg)
    },
    warn(msg, f) {
      if (f) Object.assign(fields, f)
      hintLevel = "warn"
      emit(msg)
    },
    error(msg, f) {
      if (f) Object.assign(fields, f)
      hintLevel = "error"
      emit(msg)
    },
  }
  return builder
}
