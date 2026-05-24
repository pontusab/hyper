/**
 * Hashing helpers — always `Bun.hash.xxHash3` for cache keys, ETags,
 * idempotency keys. Never `crypto.createHash('md5')` or similar.
 *
 * Constant-time compare uses `node:crypto.timingSafeEqual` (Bun's
 * zero-cost polyfill; no userland substitute).
 */

import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto"

export function xxh3(input: string | ArrayBufferView | ArrayBufferLike): string {
  const buf = typeof input === "string" ? new TextEncoder().encode(input) : input
  // Bun.hash.xxHash3 accepts ArrayBuffer/TypedArray/string.
  return Bun.hash.xxHash3(buf as Parameters<typeof Bun.hash.xxHash3>[0]).toString(16)
}

/** Build an ETag for a response body. Strong by default. */
export function etag(body: string | ArrayBufferView | ArrayBufferLike): string {
  return `"${xxh3(body)}"`
}

/**
 * Constant-time string equality. Inputs must be the same length;
 * otherwise returns false without any comparison (short-circuit is
 * safe — leaking length is not a secret-material leak).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b))
}
