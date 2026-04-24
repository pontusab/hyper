/**
 * @usehyper/openapi — OpenAPI 3.1 serializer + Swagger UI for Hyper apps.
 *
 *   import { openapiHandlers } from "@usehyper/openapi"
 *   const oa = openapiHandlers(app, { title: "My API", converters: [...] })
 *   // Then mount oa.spec at /openapi.json and oa.docs at /docs.
 *
 * SchemaConverter is pluggable — see @usehyper/openapi-zod / -valibot / -arktype.
 */

export { fallbackConverter, firstConverter, isStandardSchema } from "./converter.ts"
export type { JsonSchema, SchemaConverter } from "./converter.ts"
export { generate } from "./generate.ts"
export type { GenerateConfig, OpenAPIDoc } from "./generate.ts"
export { openapiHandlers, openapiPlugin } from "./plugin.ts"
export type { OpenApiPluginConfig } from "./plugin.ts"
export { swaggerHtml } from "./swagger.ts"
export type { SwaggerHtmlOptions } from "./swagger.ts"
