/**
 * @hyper/log types — the wide-event surface.
 *
 * One log per request is the default. Handlers call `ctx.log.set({...})`
 * to accumulate fields; the request-level event is flushed on response
 * (or error) with all fields rolled up.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

/** A single log record (one request = one event by default). */
export interface LogEvent {
  readonly ts: string
  readonly level: LogLevel
  readonly msg?: string
  readonly [key: string]: unknown
}

/** A log builder that accumulates fields and emits one event. */
export interface LogBuilder {
  /** Merge fields into the current event. Last wins. */
  set(fields: Record<string, unknown>): LogBuilder
  /** Scoped child — emits its own event with a shared prefix. */
  child(scope: string): LogBuilder
  /** Level hint; final level chosen at drain time. */
  level(l: LogLevel): LogBuilder
  /** Manually finish; normally called by the plugin on response. */
  finish(msg?: string): void
  /** Convenience shortcuts. Avoid in hot path — prefer `.set()`. */
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

/** Drain — receives rendered events. */
export interface LogDrain {
  readonly name: string
  write(event: LogEvent): void | Promise<void>
  flush?(): void | Promise<void>
  close?(): void | Promise<void>
}

export interface LogConfig {
  /** One or more drains. Defaults to stdout NDJSON. */
  drains?: readonly LogDrain[]
  /** Minimum level emitted. */
  level?: LogLevel
  /** Paths (dot-path) that are masked in serialized output. */
  redact?: readonly string[]
  /** Sampling: 0..1. Events below the cutoff drop unless `keep()` hits. */
  sampleRate?: number
  /** Predicate: if it returns true, the event is always kept. */
  keep?: (event: LogEvent) => boolean
  /** Injected clock for tests; defaults to Date.now(). */
  clock?: () => number
}
