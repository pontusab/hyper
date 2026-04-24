/**
 * SchemaConverter — the pluggable boundary.
 *
 * A converter inspects a Standard Schema value and returns an OpenAPI
 * JSON Schema fragment. The base @usehyper/openapi package ships a
 * `fallbackConverter` that just emits `type: object`. Integrations like
 * `@usehyper/openapi-zod` / `-valibot` / `-arktype` extend this.
 */

import type { StandardSchemaV1 } from "@usehyper/core"

export type JsonSchema = Record<string, unknown>

export interface SchemaConverter {
  readonly name: string
  readonly canHandle: (s: unknown) => boolean
  readonly toJsonSchema: (s: unknown) => JsonSchema
}

export const fallbackConverter: SchemaConverter = {
  name: "fallback",
  canHandle: () => true,
  toJsonSchema: () => ({ type: "object" }),
}

export function firstConverter(
  converters: readonly SchemaConverter[],
  schema: unknown,
): SchemaConverter {
  for (const c of converters) if (c.canHandle(schema)) return c
  return fallbackConverter
}

/**
 * Detect a Standard Schema value — gives us a baseline fall-through.
 */
export function isStandardSchema(x: unknown): x is StandardSchemaV1 {
  return Boolean(x && typeof x === "object" && "~standard" in (x as Record<string, unknown>))
}
