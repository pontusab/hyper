/**
 * Client-side types.
 */

/** Transport adapter — can swap fetch for something else (MessagePack, etc). */
export interface Transport {
  readonly request: (input: TransportRequest) => Promise<TransportResponse>
}

export interface TransportRequest {
  readonly method: string
  readonly url: string
  readonly headers?: Record<string, string>
  readonly body?: unknown
  readonly signal?: AbortSignal
}

export interface TransportResponse {
  readonly status: number
  readonly data: unknown
  readonly headers: Headers
}

/** Standard error shape emitted by Hyper's HTTP layer. */
export interface HyperRpcError {
  readonly status: number
  readonly code: string
  readonly message: string
  readonly why?: string
  readonly fix?: string
  readonly details?: unknown
}

/** Result union for `.throws()`/`.errors()`. */
export type Result<T, E = HyperRpcError> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E }
