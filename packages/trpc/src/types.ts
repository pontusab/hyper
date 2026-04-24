/**
 * Structural tRPC types — we avoid importing @trpc/server so the package
 * loads without the peer installed. Users pass their real router and we
 * type-narrow at the call site.
 */

// biome-ignore lint/suspicious/noExplicitAny: structural tRPC router
export type TrpcRouterLike = any

export interface TrpcBridgeOptions<Ctx = unknown> {
  /** Path prefix for the HTTP POST JSON handler. Defaults to /trpc. */
  readonly prefix?: string
  /** Build a tRPC context from the Hyper AppContext. */
  readonly createContext?: (args: {
    readonly req: Request
    readonly ctx: Ctx
  }) => Promise<unknown> | unknown
  /** Error-bridge hook — called on tRPC error before response. */
  readonly onError?: (args: { readonly path?: string; readonly error: unknown }) => void
}

export interface TrpcToHyperOptions {
  readonly prefix?: string
  /** Convert a tRPC procedure shape to Hyper `meta` (auth, mcp, etc.). */
  readonly mapMeta?: (procName: string, procedure: unknown) => Record<string, unknown>
}
