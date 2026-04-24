/**
 * @usehyper/trpc — two-way bridge.
 *
 *  - `trpcHandler(router)` — mount a tRPC router into a Hyper route handler.
 *  - `trpcToHyper(router)` — convert a tRPC router to an array of Hyper routes.
 *  - `trpcPlugin(router)`  — register the bridge as a Hyper plugin (reserved for
 *    future dynamic-route registration).
 *
 * The bridge is structurally typed so @usehyper/trpc loads without @trpc/server
 * installed. Users pass their real router and we narrow at the call site.
 */

export { sharedCtxMiddleware, trpcHandler, trpcPlugin } from "./bridge.ts"
export { trpcToHyper } from "./to-hyper.ts"
export type { TrpcBridgeOptions, TrpcRouterLike, TrpcToHyperOptions } from "./types.ts"
