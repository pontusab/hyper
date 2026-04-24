/**
 * runExamples(app) — walks every route's `meta.examples` and executes each
 * example against the in-process app.invoke() path. Used by `hyper test`
 * and directly inside consumer test files (see @usehyper/testing).
 */

import type { HttpMethod, HyperApp, RouteExample } from "./types.ts"

export interface ExampleResult {
  readonly route: string
  readonly method: string
  readonly example: string
  readonly ok: boolean
  readonly status: number
  readonly expected?: number
  readonly actual?: unknown
  readonly error?: string
}

export async function runExamples(app: HyperApp): Promise<readonly ExampleResult[]> {
  const out: ExampleResult[] = []
  for (const route of app.routeList) {
    const examples = route.meta.examples as readonly RouteExample[] | undefined
    if (!examples || examples.length === 0) continue
    for (const ex of examples) {
      const expected = ex.output?.status
      try {
        const result = await app.invoke({
          method: route.method as HttpMethod,
          path: route.path,
          ...(ex.input?.params && { params: ex.input.params as Record<string, string> }),
          ...(ex.input?.query && { query: ex.input.query }),
          ...(ex.input?.body !== undefined && { body: ex.input.body }),
          ...(ex.input?.headers && {
            headers: Object.fromEntries(
              Object.entries(ex.input.headers).map(([k, v]) => [k, String(v)]),
            ),
          }),
        })
        const statusOk = expected === undefined ? result.status < 400 : result.status === expected
        const bodyOk =
          ex.output?.body === undefined
            ? true
            : JSON.stringify(result.data) === JSON.stringify(ex.output.body)
        out.push({
          route: route.path,
          method: route.method,
          example: ex.name,
          ok: statusOk && bodyOk,
          status: result.status,
          ...(expected !== undefined && { expected }),
          ...(ex.output?.body !== undefined && { actual: result.data }),
        })
      } catch (e) {
        out.push({
          route: route.path,
          method: route.method,
          example: ex.name,
          ok: false,
          status: 0,
          error: (e as Error).message,
        })
      }
    }
  }
  return out
}
