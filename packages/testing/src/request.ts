/**
 * Request builders — `fakeRequest` and `asUser`.
 *
 * `fakeRequest` is a thin ergonomic wrapper around `new Request()` that
 * accepts the fields tests actually want (json, form, auth, cookie, ip)
 * without the ceremony of building headers by hand.
 */

import type { HttpMethod } from "@usehyper/core"

export interface FakeRequestInit {
  readonly query?: Record<string, string | number | boolean>
  readonly json?: unknown
  readonly form?: FormData | Record<string, string>
  readonly text?: string
  readonly auth?: string
  readonly cookie?: Record<string, string> | string
  readonly ip?: string
  readonly headers?: Record<string, string>
  readonly origin?: string
}

const DEFAULT_ORIGIN = "http://local"

export function fakeRequest(method: HttpMethod, path: string, init: FakeRequestInit = {}): Request {
  const origin = init.origin ?? DEFAULT_ORIGIN
  const url = new URL(path.startsWith("/") ? `${origin}${path}` : path)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, String(v))
  }
  const headers = new Headers(init.headers ?? {})
  if (init.auth) headers.set("authorization", init.auth)
  if (init.cookie !== undefined) {
    const cookie = typeof init.cookie === "string" ? init.cookie : toCookieHeader(init.cookie)
    headers.set("cookie", cookie)
  }
  if (init.ip) headers.set("x-forwarded-for", init.ip)

  let body: BodyInit | undefined
  if (init.json !== undefined) {
    body = JSON.stringify(init.json)
    if (!headers.has("content-type")) headers.set("content-type", "application/json")
  } else if (init.form !== undefined) {
    body = init.form instanceof FormData ? init.form : toFormData(init.form)
  } else if (init.text !== undefined) {
    body = init.text
    if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8")
  }

  return new Request(url, { method, headers, ...(body !== undefined && { body }) })
}

function toCookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ")
}

function toFormData(obj: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(obj)) fd.set(k, v)
  return fd
}

/**
 * Partial-ctx helper — produces a `user`-shaped stub for routes guarded
 * by `@usehyper/auth-jwt`. Bypasses JWT verify in tests that don't need a
 * signed token; use `@usehyper/testing/auth` for real-signed tokens.
 */
export interface FakeUser {
  readonly id: string
  readonly roles?: readonly string[]
  readonly claims?: Record<string, unknown>
}

export function asUser(id: string | FakeUser): { readonly user: FakeUser } {
  const u: FakeUser = typeof id === "string" ? { id } : id
  return { user: u }
}
