/**
 * @hyper/core — public entry.
 */

export const VERSION: string = "0.1.0"

// Core types
export type {
  AppConfig,
  AppContext,
  BunFileLike,
  BunRoutes,
  EnvConfigLike,
  ErrorRegistry,
  HandlerReturn,
  HttpMethod,
  HyperApp,
  HyperPlugin,
  Infer,
  InternalHandlerCtx,
  InvokeInput,
  InvokeResult,
  Route,
  RouteExample,
  RouteGroup,
  RouteHandler,
  RouteMeta,
  SecurityDefaults,
} from "./types.ts"

// Standard Schema
export type {
  StandardSchemaV1,
  StandardSchemaV1Issue,
  StandardSchemaV1Props,
  StandardSchemaV1Result,
} from "./standard-schema.ts"
export { isStandardSchema, parseStandard, SchemaValidationError } from "./standard-schema.ts"

// Builder
export { route, RouteBuilder } from "./route.ts"
export type { BuilderState, CallableRoute, HandlerCtx, InferIn } from "./route.ts"

// Middleware
export { compileChain, onError, onFinish, onStart, onSuccess } from "./middleware.ts"
export type { ChainRunner } from "./middleware.ts"
export type { Middleware, MiddlewareArgs } from "./middleware.ts"

// Composition
export { fromPlainRouter, group, GroupBuilder, lazy } from "./group.ts"
export type { LazyGroup, PlainRouter } from "./group.ts"

// App
export { app } from "./app.ts"

// Chain API — `new Hyper()` / `hyper()`
export { HYPER_BUILDER_BRAND, Hyper, hyper, joinPaths } from "./hyper.ts"
export type { HyperOptions, ListenOptions, RouteOpts, UseArg, VerbHandler } from "./hyper.ts"

// Errors
export { asHyperError, createError, HyperError } from "./error.ts"
export type { HyperErrorInit } from "./error.ts"

// Response helpers
export {
  accepted,
  badRequest,
  coerce,
  conflict,
  created,
  errorResponse,
  forbidden,
  html,
  jsonResponse,
  noContent,
  notFound,
  ok,
  redirect,
  sse,
  stream,
  text,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "./response.ts"
export type { TypedResponse } from "./response.ts"

// File
export { file } from "./file.ts"
export type { FileOptions } from "./file.ts"

// Hash / timing-safe
export { etag, timingSafeEqualStr, xxh3 } from "./hash.ts"

// Security
export {
  applyDefaultHeaders,
  assertNoProtoKeys,
  DEFAULT_BODY_LIMIT_BYTES,
  DEFAULT_RESPONSE_HEADERS,
  DEFAULT_SECURITY,
  FORBIDDEN_JSON_KEYS,
  PrototypePollutionError,
  SUPPRESSED_HEADERS,
} from "./security.ts"

// Request
export { parseBodyAuto, parseJsonBody, readTextBody } from "./request.ts"

// Decorate / derive
export { applyDerive, resolveStaticContext } from "./decorate.ts"
export type { ContextBlueprint, DecorateFactory, DeriveFactory } from "./decorate.ts"

// Env
export {
  EnvParseError,
  getSecretPaths,
  markSecrets,
  parseEnv,
  SECRET_PATHS,
  secret,
  useEnv,
  withEnv,
} from "./env.ts"
export type { EnvConfig } from "./env.ts"

// Type utilities
export type { InferRouterCtx, InferRouterInputs, InferRouterOutputs } from "./infer.ts"

// Resource bundles + examples
export { resource } from "./resource.ts"
export type { ResourceHandlers, ResourceMethod, ResourceOptions } from "./resource.ts"
export { runExamples } from "./example.ts"
export type { ExampleResult } from "./example.ts"

// Projection (OpenAPI / MCP / client manifests)
export {
  projectRoute,
  projectRoutes,
  toClientManifest,
  toMCPManifest,
  toOpenAPI,
} from "./projection.ts"
export type {
  ClientManifest,
  MCPManifest,
  MCPTool,
  OpenAPIManifest,
  OpenAPIManifestConfig,
  ProjectedRoute,
  SchemaDescriptor,
} from "./projection.ts"
