/**
 * Type-level test helpers. Re-exports `expectTypeOf` from expect-type
 * plus Hyper-shaped narrowing helpers.
 */

import type { HttpMethod, HyperApp, Route } from "@usehyper/core"

export { expectTypeOf } from "expect-type"

export interface RouteAssertion<R> {
  readonly input: {
    toEqualTypeOf<T>(): R extends { __input: infer I } ? ([I] extends [T] ? true : never) : never
  }
  readonly output: {
    toEqualTypeOf<T>(): R extends { __output: infer O } ? ([O] extends [T] ? true : never) : never
  }
}

export function expectRoute<R>(_route: R): RouteAssertion<R> {
  return {
    input: { toEqualTypeOf: () => true as never },
    output: { toEqualTypeOf: () => true as never },
  }
}

/** Runtime helper used in compile-time-shaped tests — always true. */
export function expectApp(app: HyperApp): {
  hasRoute(entry: `${HttpMethod} ${string}`): boolean
} {
  return {
    hasRoute(entry) {
      const [method, path] = entry.split(" ") as [HttpMethod, string]
      return app.routeList.some((r: Route) => r.method === method && r.path === path)
    },
  }
}
