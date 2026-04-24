/**
 * @hyper/client — typed RPC client + codegen for Hyper apps.
 *
 * Runtime:  createClient(transport) gives a `.call({ method, path, ... })` primitive.
 * Typed:    `hyper client <out>` emits `client.ts` + `client.d.ts` from the
 *           running app's `toClientManifest()`.
 * TanStack: `@hyper/client/tanstack-query` ships queryOptions / mutationOptions.
 *
 * Exports are ergonomic re-exports; see individual files for detail.
 */

export { applyPathParams, createClient, routerToClient } from "./client.ts"
export type { ClientContract } from "./client.ts"
export { generateClient } from "./codegen.ts"
export type { CodegenOptions } from "./codegen.ts"
export { subscribe } from "./sse.ts"
export type { SubscribeOptions } from "./sse.ts"
export { fetchTransport } from "./transport.ts"
export type { FetchTransportConfig } from "./transport.ts"
export type {
  HyperRpcError,
  Result,
  Transport,
  TransportRequest,
  TransportResponse,
} from "./types.ts"

// Re-export core typing utilities for convenience
export type {
  InferRouterCtx,
  InferRouterInputs,
  InferRouterOutputs,
} from "@hyper/core"
