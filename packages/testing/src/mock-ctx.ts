/**
 * `mockCtx(overrides)` — build a typed AppContext stub for calling a
 * route as a plain async function via `route.callable({ ctx })`.
 *
 * The type-level augmentation on `AppContext` is respected: if your app
 * declares `interface AppContext { db: Db; user?: User }`, then
 * `mockCtx({ db: fakeDb })` returns `AppContext` with those fields set.
 */

import type { AppContext } from "@hyper/core"

export function mockCtx<T extends Partial<AppContext> = Partial<AppContext>>(
  overrides: T = {} as T,
): AppContext {
  return overrides as unknown as AppContext
}
