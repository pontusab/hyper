/**
 * Structured errors.
 *
 * Hyper distinguishes thrown errors (unexpected) from returned errors
 * (contract-defined). `createError` produces the thrown shape with
 * `why`/`fix` fields that surface in logs, error responses, and the
 * MCP error payload — making failures actionable for both humans
 * and agents.
 */

export interface HyperErrorInit {
  /** HTTP status to project (defaults to 500). */
  status?: number
  /** Short machine code (e.g., "email_exists"). */
  code?: string
  /** Human message. */
  message: string
  /** Why this happened — explained to the caller (not internal details). */
  why?: string
  /** How to fix it — agent-actionable. */
  fix?: string
  /** Documentation or recovery links. */
  links?: readonly string[]
  /** Arbitrary structured detail (redacted in logs if matching secret paths). */
  details?: Record<string, unknown>
  /** Underlying cause (stripped from wire response; kept in logs). */
  cause?: unknown
}

export class HyperError extends Error {
  readonly status: number
  readonly code?: string
  readonly why?: string
  readonly fix?: string
  readonly links?: readonly string[]
  readonly details?: Record<string, unknown>

  constructor(init: HyperErrorInit) {
    super(init.message, { cause: init.cause })
    this.name = "HyperError"
    this.status = init.status ?? 500
    if (init.code !== undefined) this.code = init.code
    if (init.why !== undefined) this.why = init.why
    if (init.fix !== undefined) this.fix = init.fix
    if (init.links !== undefined) this.links = init.links
    if (init.details !== undefined) this.details = init.details
  }

  /** Wire shape — safe to serialize to clients and agents. */
  toJSON(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      error: {
        status: this.status,
        message: this.message,
      },
    }
    const err = base.error as Record<string, unknown>
    if (this.code) err.code = this.code
    if (this.why) err.why = this.why
    if (this.fix) err.fix = this.fix
    if (this.links) err.links = this.links
    if (this.details) err.details = this.details
    return base
  }
}

/** Factory — preferred API. */
export function createError(init: HyperErrorInit): HyperError {
  return new HyperError(init)
}

/** Project unknown errors into a HyperError at the boundary. */
export function asHyperError(e: unknown): HyperError {
  if (e instanceof HyperError) return e
  if (e instanceof Error) {
    return new HyperError({
      status: 500,
      message: e.message || "Internal Server Error",
      why: "Handler threw an unhandled error.",
      fix: "Check server logs for the stack trace.",
      cause: e,
    })
  }
  return new HyperError({
    status: 500,
    message: "Internal Server Error",
    why: "Handler threw a non-Error value.",
    cause: e,
  })
}
