/**
 * @hyper/openapi-arktype — SchemaConverter for ArkType.
 *
 * ArkType types expose a `toJsonSchema()` method (v2+). We thin-wrap that
 * so users get proper JSON Schema without pulling ArkType at runtime.
 */

import type { JsonSchema, SchemaConverter } from "@hyper/openapi"

interface ArkType {
  readonly toJsonSchema?: () => JsonSchema
  readonly infer?: unknown
  readonly definition?: unknown
}

function isArkType(s: unknown): s is ArkType {
  if (!s || typeof s !== "object") return false
  const x = s as Record<string, unknown>
  return typeof x.toJsonSchema === "function" && ("infer" in x || "definition" in x)
}

export const arktypeConverter: SchemaConverter = {
  name: "arktype",
  canHandle: isArkType,
  toJsonSchema: (s) => {
    const t = s as ArkType
    try {
      return t.toJsonSchema?.() ?? { type: "object" }
    } catch {
      return { type: "object" }
    }
  },
}
