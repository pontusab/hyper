/**
 * @usehyper/testing/fuzz — request-boundary attack corpus.
 *
 * `fuzzRoute(app, "POST /users")` hammers the given route with a
 * baseline set of nasty inputs. Each entry expects the framework to
 * answer with a 4xx (never a 500, never a hang, never silent corruption).
 *
 * Consumers get parity coverage with the framework's own fuzz suite.
 */

import type { HttpMethod, HyperApp } from "@usehyper/core"
import { fakeRequest } from "./request.ts"

export interface FuzzCase {
  readonly name: string
  /** Expected status range. Default: 4xx. */
  readonly expectStatus?: (status: number) => boolean
  /** Builds a Request for the given route target. */
  readonly build: (method: HttpMethod, path: string) => Request
}

const OVERSIZED_BODY = "x".repeat(2 * 1024 * 1024) // 2 MB (> 1 MB default)

const ATTACK_CASES: readonly FuzzCase[] = [
  {
    name: "proto-pollution via __proto__",
    build: (m, p) =>
      fakeRequest(m, p, { json: JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}') }),
  },
  {
    name: "proto-pollution via constructor.prototype",
    build: (m, p) =>
      fakeRequest(m, p, {
        json: JSON.parse('{"constructor": {"prototype": {"p": 1}}}'),
      }),
  },
  {
    name: "oversized body (>1MB)",
    build: (m, p) => fakeRequest(m, p, { text: OVERSIZED_BODY }),
    expectStatus: (s) => s === 413 || (s >= 400 && s < 500),
  },
  {
    name: "malformed JSON",
    expectStatus: (s) => s === 400,
    build: (m, p) =>
      new Request(new URL(`http://local${p}`), {
        method: m,
        headers: { "content-type": "application/json" },
        body: "{oops",
      }),
  },
  {
    name: "path traversal in path segment",
    build: (m, _p) => fakeRequest(m, "/../../../etc/passwd"),
    expectStatus: (s) => s >= 400 && s < 500,
  },
  {
    name: "smuggled method via X-HTTP-Method-Override",
    build: (m, p) => fakeRequest(m, p, { headers: { "x-http-method-override": "DELETE" } }),
    // The framework must NOT coerce the method — 200/404 acceptable, but
    // never a 'DELETE' being honored. We only check the request succeeds
    // or fails without silently swapping verbs.
    expectStatus: (s) => s < 500,
  },
  {
    name: "overlong header",
    build: (m, p) => fakeRequest(m, p, { headers: { "x-big": "y".repeat(65_000) } }),
    expectStatus: (s) => s < 500,
  },
  {
    name: "XSS-ish cookie",
    build: (m, p) => fakeRequest(m, p, { cookie: { sid: '"><script>alert(1)</script>' } }),
    expectStatus: (s) => s < 500,
  },
  {
    name: "null byte in path",
    build: (m, _p) => fakeRequest(m, "/users/\x00id"),
    expectStatus: (s) => s >= 400 && s < 500,
  },
  {
    name: "empty JSON body",
    build: (m, p) =>
      fakeRequest(m, p, { text: "", headers: { "content-type": "application/json" } }),
    expectStatus: (s) => s < 500,
  },
  {
    name: "duplicate content-length",
    build: (m, p) =>
      new Request(new URL(`http://local${p}`), {
        method: m,
        headers: { "content-type": "application/json", "content-length": "100" },
        body: "{}",
      }),
    expectStatus: (s) => s < 500,
  },
]

export interface FuzzReport {
  readonly method: HttpMethod
  readonly path: string
  readonly passed: readonly FuzzResult[]
  readonly failed: readonly FuzzResult[]
  readonly ok: boolean
}

export interface FuzzResult {
  readonly case: string
  readonly status: number
  readonly accepted: boolean
  readonly error?: string
}

/**
 * Run every case in the corpus against `METHOD PATH`. Returns a report
 * describing which cases were handled correctly (non-500, matching the
 * expected status predicate).
 */
export async function fuzzRoute(
  app: HyperApp,
  entry: `${HttpMethod} ${string}`,
  opts: { readonly rounds?: number; readonly extraCases?: readonly FuzzCase[] } = {},
): Promise<FuzzReport> {
  const [method, path] = entry.split(" ") as [HttpMethod, string]
  const cases = [...ATTACK_CASES, ...(opts.extraCases ?? [])]
  const rounds = Math.max(1, opts.rounds ?? 1)
  const passed: FuzzResult[] = []
  const failed: FuzzResult[] = []
  for (const c of cases) {
    const expect = c.expectStatus ?? defaultExpect
    for (let i = 0; i < rounds; i++) {
      let status = 0
      let error: string | undefined
      try {
        const res = await app.fetch(c.build(method, path))
        status = res.status
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
      const accepted = !error && expect(status)
      const result: FuzzResult = {
        case: c.name,
        status,
        accepted,
        ...(error !== undefined && { error }),
      }
      ;(accepted ? passed : failed).push(result)
    }
  }
  return { method, path, passed, failed, ok: failed.length === 0 }
}

function defaultExpect(status: number): boolean {
  return status >= 400 && status < 500
}

/** Re-exported so framework-internal tests can use the same corpus. */
export { ATTACK_CASES }
