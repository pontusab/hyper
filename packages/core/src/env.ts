/**
 * Environment configuration — layered & parsed once at boot.
 *
 * - `app({ env: schema })` for global, plus `.env(schema)` on group/route.
 * - Layers merge by intersection: the handler sees the union of all
 *   declared fields with narrowed types.
 * - Parse errors throw at boot with a `why`/`fix` shape listing every
 *   field that failed (agents fix all of them in one edit).
 * - Secret marking: paths matching the provided `secret` paths are
 *   redacted by `@usehyper/log` and never echoed to error responses.
 * - `useEnv()` via AsyncLocalStorage for deep code.
 */

import { AsyncLocalStorage } from "node:async_hooks"
import { HyperError } from "./error.ts"
import { SchemaValidationError, parseStandard } from "./standard-schema.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"

export interface EnvConfig {
  readonly schema?: StandardSchemaV1
  /** Dot-paths that should be treated as secret (auto-redacted). */
  readonly secrets?: readonly string[]
  /** Source env (defaults to process.env). */
  readonly source?: Record<string, string | undefined>
}

const envStorage = new AsyncLocalStorage<Record<string, unknown>>()

/** Retrieve the current request's env (runs inside an async scope). */
export function useEnv<T = Record<string, unknown>>(): T {
  const env = envStorage.getStore()
  if (!env) {
    throw new HyperError({
      status: 500,
      message: "useEnv() called outside a request scope.",
      why: "AsyncLocalStorage has no env; the app is likely not initialized.",
      fix: "Ensure code paths using useEnv() run inside the app.fetch() pipeline.",
    })
  }
  return env as T
}

export function withEnv<T>(env: Record<string, unknown>, fn: () => T): T {
  return envStorage.run(env, fn)
}

/**
 * Parse a collection of layer-schemas against `source` once at boot.
 * Returns the merged typed env. Throws `EnvParseError` with a per-field
 * breakdown on failure.
 */
export async function parseEnv(
  layers: readonly StandardSchemaV1[],
  source: Record<string, string | undefined> = process.env,
): Promise<Record<string, unknown>> {
  if (layers.length === 0) return { ...source }
  const out: Record<string, unknown> = {}
  const allIssues: Array<{ layer: number; path: string; message: string }> = []
  for (let i = 0; i < layers.length; i++) {
    const schema = layers[i]!
    try {
      const parsed = (await parseStandard(schema, source)) as Record<string, unknown>
      Object.assign(out, parsed)
    } catch (e) {
      if (e instanceof SchemaValidationError) {
        for (const issue of e.issues) {
          allIssues.push({
            layer: i,
            path: (issue.path ?? []).map(String).join(".") || "(root)",
            message: issue.message,
          })
        }
      } else {
        throw e
      }
    }
  }
  if (allIssues.length > 0) throw new EnvParseError(allIssues)
  return out
}

export class EnvParseError extends Error {
  readonly issues: ReadonlyArray<{ layer: number; path: string; message: string }>
  constructor(issues: ReadonlyArray<{ layer: number; path: string; message: string }>) {
    const lines = issues.map((i) => `  layer ${i.layer} ${i.path}: ${i.message}`).join("\n")
    super(`Environment did not match declared schema:\n${lines}`)
    this.name = "EnvParseError"
    this.issues = issues
  }
}

/**
 * Mark secret paths on an env object in-place for @usehyper/log consumers.
 * A non-enumerable symbol keyed off the env carries the list.
 */
export const SECRET_PATHS: unique symbol = Symbol.for("@usehyper/core/secret-paths")

export function markSecrets<T extends object>(env: T, paths: readonly string[]): T {
  Object.defineProperty(env, SECRET_PATHS, {
    value: Object.freeze([...paths]),
    enumerable: false,
  })
  return env
}

export function getSecretPaths(env: object): readonly string[] | undefined {
  const paths = (env as Record<PropertyKey, unknown>)[SECRET_PATHS]
  if (!paths) return undefined
  return paths as readonly string[]
}

/** Helper: wrap a Standard Schema field with a marker string. */
export function secret<T>(schema: T): T & { __hyperSecret: true } {
  return schema as T & { __hyperSecret: true }
}
