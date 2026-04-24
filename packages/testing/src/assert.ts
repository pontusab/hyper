/**
 * `assertResponse(res)` — fluent matcher that integrates with bun:test
 * expect failures.
 *
 * Each matcher returns `this` for chaining. On mismatch we throw with a
 * descriptive message; bun:test surfaces the throw as a failed expect.
 */

/** Minimal subset of match semantics we need — deep partial equality. */
function matches(actual: unknown, expected: unknown): boolean {
  if (expected instanceof RegExp) return typeof actual === "string" && expected.test(actual)
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false
    return expected.every((e, i) => matches(actual[i], e))
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false
    for (const [k, v] of Object.entries(expected)) {
      if (!matches((actual as Record<string, unknown>)[k], v)) return false
    }
    return true
  }
  return Object.is(actual, expected)
}

export interface Assertion {
  readonly raw: Response
  hasStatus(code: number): Assertion
  hasHeader(name: string, matcher?: string | RegExp): Assertion
  hasCookie(name: string): Assertion
  hasJson(partial: unknown): Promise<Assertion>
  hasText(text: string | RegExp): Promise<Assertion>
  isError(shape?: { code?: string; status?: number; message?: string | RegExp }): Promise<Assertion>
  json<T = unknown>(): Promise<T>
}

export function assertResponse(res: Response): Assertion {
  const self: Assertion = {
    raw: res,
    hasStatus(code) {
      if (res.status !== code) throw new Error(`expected status ${code}, got ${res.status}`)
      return self
    },
    hasHeader(name, matcher) {
      const v = res.headers.get(name)
      if (v === null) throw new Error(`expected header ${name} to be set`)
      if (matcher !== undefined && !matches(v, matcher)) {
        throw new Error(`header ${name}=${v} did not match ${String(matcher)}`)
      }
      return self
    },
    hasCookie(name) {
      const set = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie") ?? ""]
      const found = set.some((c) => c?.startsWith(`${name}=`))
      if (!found) throw new Error(`expected Set-Cookie for ${name}`)
      return self
    },
    async hasJson(partial) {
      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("application/json"))
        throw new Error(`expected JSON response, got ${ct || "(none)"}`)
      const body = await res.clone().json()
      if (!matches(body, partial)) {
        throw new Error(
          `response body did not match.\n  expected: ${JSON.stringify(partial)}\n  actual:   ${JSON.stringify(body)}`,
        )
      }
      return self
    },
    async hasText(text) {
      const body = await res.clone().text()
      if (!matches(body, text)) throw new Error(`response text did not match ${String(text)}`)
      return self
    },
    async isError(shape = {}) {
      const body = (await res
        .clone()
        .json()
        .catch(() => null)) as { error?: Record<string, unknown> } | null
      const err = body?.error ?? null
      if (!err) throw new Error("expected Hyper error envelope")
      if (shape.code !== undefined && err.code !== shape.code) {
        throw new Error(`expected error code ${shape.code}, got ${String(err.code)}`)
      }
      if (shape.status !== undefined && res.status !== shape.status) {
        throw new Error(`expected error status ${shape.status}, got ${res.status}`)
      }
      if (shape.message !== undefined && !matches(err.message, shape.message)) {
        throw new Error(`error.message did not match ${String(shape.message)}`)
      }
      return self
    },
    async json<T>() {
      return (await res.clone().json()) as T
    },
  }
  return self
}
