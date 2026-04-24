/**
 * openapiPlugin — exposes /openapi.json and /docs.
 *
 * Plugins don't add routes directly; the consumer mounts our two handlers
 * explicitly (`openapiHandlers(...)`) and the plugin wires default-on
 * cache headers for the spec URL.
 */

import type { HyperApp, HyperPlugin, InvokeInput, Route } from "@usehyper/core"
import type { SchemaConverter } from "./converter.ts"
import { type GenerateConfig, type OpenAPIDoc, generate } from "./generate.ts"
import { type SwaggerHtmlOptions, swaggerHtml } from "./swagger.ts"

export interface OpenApiPluginConfig extends GenerateConfig, SwaggerHtmlOptions {}

export function openapiPlugin(config: OpenApiPluginConfig = {}): HyperPlugin {
  return {
    name: "@usehyper/openapi",
    build() {
      // Reserved for future dynamic-route registration.
    },
  }
}

/** Standalone handler pair users mount on their app. */
export function openapiHandlers(
  app: HyperApp,
  config: OpenApiPluginConfig = {},
): {
  spec: (req: Request) => Response
  docs: (req: Request) => Response
  doc: OpenAPIDoc
} {
  const doc = generate(app, config)
  const docJson = JSON.stringify(doc)
  const html = swaggerHtml({
    ...(config.specUrl !== undefined && { specUrl: config.specUrl }),
    ...(config.title !== undefined && { title: config.title }),
  })
  return {
    doc,
    spec: () =>
      new Response(docJson, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      }),
    docs: () =>
      new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      }),
  }
}

// Unused but exported for TypeScript — keeps the type dep alive.
export type _InvokeInput = InvokeInput
export type _Route = Route
export type _SchemaConverter = SchemaConverter
