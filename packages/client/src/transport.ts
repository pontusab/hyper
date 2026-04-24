/**
 * Default fetch-backed transport.
 *
 * Supports JSON by default; a wire-format hook (MessagePack, etc.) can
 * be added by passing a custom `encode`/`decode` pair.
 */

import type { Transport, TransportRequest, TransportResponse } from "./types.ts"

export interface FetchTransportConfig {
  readonly baseUrl: string
  readonly headers?: Record<string, string>
  readonly fetch?: typeof fetch
  readonly encode?: (body: unknown) => BodyInit | undefined
  readonly decode?: (res: Response) => Promise<unknown>
}

const defaultEncode = (body: unknown): BodyInit | undefined => {
  if (body === undefined || body === null) return undefined
  if (typeof body === "string" || body instanceof ArrayBuffer || body instanceof Uint8Array) {
    return body as BodyInit
  }
  return JSON.stringify(body)
}

const defaultDecode = async (res: Response): Promise<unknown> => {
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) return res.json()
  if (ct.startsWith("text/")) return res.text()
  if (res.status === 204) return undefined
  return res.arrayBuffer()
}

export function fetchTransport(cfg: FetchTransportConfig): Transport {
  const encode = cfg.encode ?? defaultEncode
  const decode = cfg.decode ?? defaultDecode
  const fetchImpl = cfg.fetch ?? globalThis.fetch.bind(globalThis)
  return {
    async request(input: TransportRequest): Promise<TransportResponse> {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...cfg.headers,
        ...input.headers,
      }
      const body = encode(input.body)
      const res = await fetchImpl(joinUrl(cfg.baseUrl, input.url), {
        method: input.method,
        headers,
        ...(body !== undefined && { body }),
        ...(input.signal ? { signal: input.signal } : {}),
      })
      const data = await decode(res)
      return { status: res.status, data, headers: res.headers }
    },
  }
}

function joinUrl(base: string, path: string): string {
  if (/^https?:/.test(path)) return path
  const cleanBase = base.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
