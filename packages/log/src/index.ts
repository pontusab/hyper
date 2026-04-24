/**
 * @usehyper/log — wide-event structured logger.
 *
 * Straight to the point:
 * - One log event per request (wide events), attached to `ctx.log`.
 * - Drains: stdout (default), file, axiom, memory (tests). BYO is easy.
 * - Redacts secrets by default; `secret()` marks env fields for auto-redaction.
 * - No runtime deps besides @usehyper/core peer.
 */

export { createLogBuilder } from "./builder.ts"
export { wrapQueries } from "./wrap-queries.ts"
export { axiomDrain, fileDrain, memoryDrain, stdoutDrain } from "./drains.ts"
export type { AxiomDrainConfig } from "./drains.ts"
export { hyperLog } from "./plugin.ts"
export type { HyperLogPluginConfig } from "./plugin.ts"
export { DEFAULT_REDACT, redact } from "./redact.ts"
export type { LogBuilder, LogConfig, LogDrain, LogEvent, LogLevel } from "./types.ts"
