/**
 * @usehyper/openapi-valibot — SchemaConverter for Valibot schemas.
 *
 * Valibot schemas are plain objects with a `kind: "schema"` marker plus
 * `type` field (e.g. "object", "string", "array", "union", "optional").
 */

import type { JsonSchema, SchemaConverter } from "@usehyper/openapi"

interface ValibotSchema {
  readonly kind: "schema"
  readonly type: string
  readonly expects?: string
  readonly [k: string]: unknown
}

function isValibot(s: unknown): s is ValibotSchema {
  if (!s || typeof s !== "object") return false
  const x = s as Record<string, unknown>
  return x.kind === "schema" && typeof x.type === "string"
}

function toJson(v: ValibotSchema): JsonSchema {
  switch (v.type) {
    case "string":
      return { type: "string" }
    case "number":
      return { type: "number" }
    case "boolean":
      return { type: "boolean" }
    case "literal":
      return { const: (v as { literal: unknown }).literal }
    case "picklist":
    case "enum":
      return { enum: (v as { options: readonly unknown[] }).options }
    case "array": {
      const item = (v as { item: ValibotSchema }).item
      return { type: "array", items: toJson(item) }
    }
    case "object": {
      const entries = (v as { entries: Record<string, ValibotSchema> }).entries
      const properties: Record<string, JsonSchema> = {}
      const required: string[] = []
      for (const [k, sub] of Object.entries(entries)) {
        properties[k] = toJson(sub)
        if (sub.type !== "optional" && sub.type !== "nullish") required.push(k)
      }
      return {
        type: "object",
        properties,
        ...(required.length > 0 && { required }),
      }
    }
    case "optional":
    case "nullish":
      return toJson((v as { wrapped: ValibotSchema }).wrapped)
    case "nullable": {
      const j = toJson((v as { wrapped: ValibotSchema }).wrapped)
      const t = j.type
      return { ...j, type: Array.isArray(t) ? [...t, "null"] : t ? [t as string, "null"] : "null" }
    }
    case "union": {
      const opts = (v as { options: readonly ValibotSchema[] }).options
      return { anyOf: opts.map(toJson) }
    }
    default:
      return {}
  }
}

export const valibotConverter: SchemaConverter = {
  name: "valibot",
  canHandle: isValibot,
  toJsonSchema: (s) => toJson(s as ValibotSchema),
}
