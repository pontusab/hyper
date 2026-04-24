/**
 * hyperLog({ ... }) — the reference plugin.
 *
 * Wires a per-request LogBuilder into `ctx.log` via the plugin protocol:
 *
 *   - `context()` — nothing (we want per-request state, not a singleton)
 *   - `request.before` — constructs a LogBuilder and attaches it to ctx.log
 *   - `request.after` — finishes the event with status/duration/route
 *   - `request.onError` — finishes the event at `error` level with why/fix
 *
 * Request correlation: we hook `ctx.log` directly on the AppContext object.
 * Because plugins run against the same `ctx` for before/after/onError, this
 * is safe without AsyncLocalStorage (which is reserved for useEnv()).
 */

import type { HyperPlugin } from "@usehyper/core"
import { createLogBuilder } from "./builder.ts"
import { stdoutDrain } from "./drains.ts"
import { DEFAULT_REDACT, redact } from "./redact.ts"
import type { LogBuilder, LogConfig, LogEvent } from "./types.ts"

const REQUEST_ID_HEADER = "x-request-id"

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `r_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export interface HyperLogPluginConfig extends LogConfig {
  /** Tag every event with this service name. */
  service?: string
  /** If true, include `req.headers` (with redaction). Default: false. */
  includeHeaders?: boolean
}

export function hyperLog(config: HyperLogPluginConfig = {}): HyperPlugin {
  const drains = config.drains ?? [stdoutDrain()]
  const minLevel = config.level ?? "info"
  const clock = config.clock ?? Date.now
  const redactPaths = config.redact ?? DEFAULT_REDACT
  const sampleRate = config.sampleRate ?? 1
  const keep = config.keep

  const render = (event: LogEvent): LogEvent => {
    const masked = redact(event, redactPaths) as LogEvent
    if (config.service !== undefined && masked.service === undefined) {
      return { ...masked, service: config.service } as LogEvent
    }
    return masked
  }
  const sample = (event: LogEvent): boolean => {
    if (sampleRate >= 1) return true
    if (keep?.(event)) return true
    return Math.random() < sampleRate
  }

  return {
    name: "@usehyper/log",
    request: {
      before({ req, ctx }) {
        const startedAt = clock()
        const requestId = req.headers.get(REQUEST_ID_HEADER) ?? makeId()
        const log = createLogBuilder({
          drains,
          minLevel,
          clock,
          render,
          sample,
          parentFields: {
            request_id: requestId,
            method: req.method,
            path: new URL(req.url).pathname,
            ...(config.includeHeaders
              ? { headers: Object.fromEntries(req.headers.entries()) }
              : {}),
          },
        })
        const ctxMut = ctx as unknown as {
          log: LogBuilder
          _logStartedAt: number
          _logRequestId: string
        }
        ctxMut.log = log
        ctxMut._logStartedAt = startedAt
        ctxMut._logRequestId = requestId
      },
      after({ ctx, res, route }) {
        const ctxAny = ctx as unknown as {
          log?: LogBuilder
          _logStartedAt?: number
        }
        const log = ctxAny.log
        if (!log) return
        const durMs = ctxAny._logStartedAt ? clock() - ctxAny._logStartedAt : undefined
        log.set({
          status: res.status,
          ...(durMs !== undefined ? { duration_ms: durMs } : {}),
          ...(route ? { route: route.path, method: route.method } : {}),
        })
        const level = res.status >= 500 ? "error" : res.status >= 400 ? "warn" : "info"
        log.level(level).finish("request")
      },
      onError({ ctx, error, route }) {
        const ctxAny = ctx as unknown as {
          log?: LogBuilder
          _logStartedAt?: number
        }
        const log = ctxAny.log
        if (!log) return
        const durMs = ctxAny._logStartedAt ? clock() - ctxAny._logStartedAt : undefined
        const err = error as { message?: string; code?: string; why?: string; fix?: string }
        log.set({
          ...(durMs !== undefined ? { duration_ms: durMs } : {}),
          ...(route ? { route: route.path, method: route.method } : {}),
          err: {
            message: err?.message,
            code: err?.code,
            why: err?.why,
            fix: err?.fix,
          },
        })
        log.level("error").finish("request_error")
      },
    },
  }
}
