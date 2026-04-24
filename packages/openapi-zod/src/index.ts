/**
 * @usehyper/openapi-zod — SchemaConverter that understands Zod v3 and v4.
 *
 *   import { zodConverter } from "@usehyper/openapi-zod"
 *   openapiHandlers(app, { converters: [zodConverter] })
 *
 * Detection:
 *  - Zod schemas expose `_def.typeName` (v3) or `_def.type` (v4).
 *  - We sniff structurally so Zod isn't required at import-time.
 *
 * This converter does not rely on `zod-to-json-schema`; it walks `_def`
 * directly for the subset of types we care about (object / array / string
 * / number / boolean / enum / union / optional / nullable / default).
 */

import type { JsonSchema, SchemaConverter } from "@usehyper/openapi"

interface ZodLike {
  readonly _def: ZodDef
  readonly parse?: (...a: unknown[]) => unknown
  readonly safeParse?: (...a: unknown[]) => unknown
}

interface ZodDef {
  readonly typeName?: string
  readonly type?: string
  readonly [k: string]: unknown
}

function isZod(s: unknown): s is ZodLike {
  if (!s || typeof s !== "object") return false
  const x = s as { _def?: unknown; parse?: unknown; safeParse?: unknown }
  if (!x._def || typeof x._def !== "object") return false
  return typeof x.parse === "function" || typeof x.safeParse === "function"
}

function defName(def: ZodDef): string | undefined {
  return (def.typeName ?? def.type) as string | undefined
}

function toJson(schema: ZodLike): JsonSchema {
  const def = schema._def
  const name = defName(def)
  switch (name) {
    case "ZodString":
    case "string":
      return { type: "string" }
    case "ZodNumber":
    case "number":
      return { type: "number" }
    case "ZodBoolean":
    case "boolean":
      return { type: "boolean" }
    case "ZodLiteral":
    case "literal":
      return { const: (def as { value: unknown }).value }
    case "ZodEnum":
    case "enum": {
      const v = def as { values?: readonly unknown[]; entries?: Record<string, unknown> }
      const values = v.values ?? (v.entries ? Object.values(v.entries) : [])
      return { enum: values }
    }
    case "ZodArray":
    case "array": {
      const v = def as { type?: ZodLike; element?: ZodLike }
      const inner = v.type ?? v.element
      return { type: "array", ...(inner && { items: toJson(inner) }) }
    }
    case "ZodObject":
    case "object": {
      const shapeFn = (def as { shape?: () => Record<string, ZodLike> }).shape
      const shape =
        typeof shapeFn === "function"
          ? shapeFn()
          : ((def as { shape?: Record<string, ZodLike> }).shape ?? {})
      const properties: Record<string, JsonSchema> = {}
      const required: string[] = []
      for (const [k, v] of Object.entries(shape)) {
        const inner = toJson(v)
        properties[k] = inner
        const innerName = defName(v._def)
        if (innerName !== "ZodOptional" && innerName !== "optional") required.push(k)
      }
      return {
        type: "object",
        properties,
        ...(required.length > 0 && { required }),
      }
    }
    case "ZodOptional":
    case "optional": {
      const inner = (def as { innerType: ZodLike }).innerType
      return toJson(inner)
    }
    case "ZodNullable":
    case "nullable": {
      const inner = (def as { innerType: ZodLike }).innerType
      const j = toJson(inner)
      const t = j.type
      return { ...j, type: Array.isArray(t) ? [...t, "null"] : t ? [t as string, "null"] : "null" }
    }
    case "ZodDefault":
    case "default": {
      const inner = (def as { innerType: ZodLike }).innerType
      return { ...toJson(inner), default: (def as { defaultValue?: unknown }).defaultValue }
    }
    case "ZodUnion":
    case "union": {
      const options = (def as { options: readonly ZodLike[] }).options
      return { anyOf: options.map(toJson) }
    }
    default:
      return {}
  }
}

export const zodConverter: SchemaConverter = {
  name: "zod",
  canHandle: isZod,
  toJsonSchema: (s) => toJson(s as ZodLike),
}
