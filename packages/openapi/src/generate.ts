/**
 * Convert a Hyper app's route list into an OpenAPI 3.1 document,
 * threading schemas through the registered `SchemaConverter`s.
 */

import type { HyperApp, Route, RouteExample } from "@hyper/core"
import { type JsonSchema, type SchemaConverter, firstConverter } from "./converter.ts"

export interface GenerateConfig {
  readonly title?: string
  readonly version?: string
  readonly description?: string
  readonly servers?: readonly { url: string; description?: string }[]
  readonly converters?: readonly SchemaConverter[]
}

export interface OpenAPIDoc {
  readonly openapi: "3.1.0"
  readonly info: { title: string; version: string; description?: string }
  readonly servers?: readonly { url: string; description?: string }[]
  readonly paths: Record<string, Record<string, OpenAPIOperation>>
  readonly components?: { schemas?: Record<string, JsonSchema> }
}

interface OpenAPIOperation {
  readonly operationId?: string
  readonly summary?: string
  readonly tags?: readonly string[]
  readonly deprecated?: boolean
  readonly parameters?: readonly OpenAPIParam[]
  readonly requestBody?: {
    readonly content: Record<string, { schema: JsonSchema; examples?: Record<string, unknown> }>
  }
  readonly responses: Record<
    string,
    { description: string; content?: Record<string, { schema?: JsonSchema; example?: unknown }> }
  >
  readonly "x-sunset"?: string
  readonly "x-version"?: string
}

interface OpenAPIParam {
  readonly name: string
  readonly in: "path" | "query" | "header"
  readonly required: boolean
  readonly schema?: JsonSchema
}

const PATH_PARAM = /:([A-Za-z0-9_]+)/g

export function generate(app: HyperApp, cfg: GenerateConfig = {}): OpenAPIDoc {
  const converters = cfg.converters ?? []
  const paths: Record<string, Record<string, OpenAPIOperation>> = {}
  for (const r of app.routeList) {
    if (r.meta.internal) continue
    const p = toOpenApiPath(r.path)
    const operation = buildOperation(r, converters)
    if (!paths[p]) paths[p] = {}
    paths[p][r.method.toLowerCase()] = operation
  }
  return {
    openapi: "3.1.0",
    info: {
      title: cfg.title ?? "Hyper API",
      version: cfg.version ?? "0.0.0",
      ...(cfg.description !== undefined && { description: cfg.description }),
    },
    ...(cfg.servers && { servers: cfg.servers }),
    paths,
  }
}

function toOpenApiPath(path: string): string {
  return path.replace(PATH_PARAM, "{$1}")
}

function buildOperation(r: Route, converters: readonly SchemaConverter[]): OpenAPIOperation {
  const parameters: OpenAPIParam[] = []
  for (const match of r.path.matchAll(PATH_PARAM)) {
    parameters.push({ name: match[1]!, in: "path", required: true })
  }
  if (r.query) {
    const conv = firstConverter(converters, r.query)
    const js = conv.toJsonSchema(r.query)
    if (js.type === "object" && typeof js.properties === "object" && js.properties) {
      const required = new Set<string>((js.required as string[]) ?? [])
      for (const [name, sub] of Object.entries(js.properties as Record<string, JsonSchema>)) {
        parameters.push({
          name,
          in: "query",
          required: required.has(name),
          schema: sub,
        })
      }
    }
  }

  let requestBody: OpenAPIOperation["requestBody"]
  if (r.body) {
    const conv = firstConverter(converters, r.body)
    const schema = conv.toJsonSchema(r.body)
    const examples = buildBodyExamples(r.meta.examples as readonly RouteExample[] | undefined)
    requestBody = {
      content: {
        "application/json": {
          schema,
          ...(examples && { examples }),
        },
      },
    }
  }

  const responseExamples = buildResponseExamples(
    r.meta.examples as readonly RouteExample[] | undefined,
  )
  const responses: OpenAPIOperation["responses"] = {
    "200": {
      description: "success",
      ...(responseExamples && {
        content: { "application/json": { example: responseExamples } },
      }),
    },
  }

  if (r.throws) {
    for (const [status, schema] of Object.entries(r.throws)) {
      const conv = firstConverter(converters, schema)
      responses[status] = {
        description: "declared error",
        content: { "application/json": { schema: conv.toJsonSchema(schema) } },
      }
    }
  }

  const meta = r.meta
  const deprecated = !!meta.deprecated
  const sunset =
    typeof meta.deprecated === "object" && meta.deprecated?.sunset
      ? meta.deprecated.sunset
      : undefined
  return {
    ...(meta.name !== undefined && { operationId: meta.name }),
    ...(meta.tags !== undefined && { tags: meta.tags }),
    ...(deprecated && { deprecated: true }),
    ...(parameters.length > 0 && { parameters }),
    ...(requestBody && { requestBody }),
    responses,
    ...(sunset && { "x-sunset": sunset }),
    ...(meta.version !== undefined && { "x-version": meta.version }),
  }
}

function buildBodyExamples(
  examples: readonly RouteExample[] | undefined,
): Record<string, { value: unknown }> | undefined {
  if (!examples) return undefined
  const out: Record<string, { value: unknown }> = {}
  for (const ex of examples) {
    if (ex.input?.body !== undefined) out[ex.name] = { value: ex.input.body }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function buildResponseExamples(examples: readonly RouteExample[] | undefined): unknown | undefined {
  if (!examples) return undefined
  const ex = examples.find((e) => e.output?.body !== undefined)
  return ex?.output?.body
}
