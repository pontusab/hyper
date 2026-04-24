/**
 * `call(app, method, path, init?)` — runs the full pipeline in-process,
 * returns a real Response. The recommended integration-test primitive.
 *
 * Accepts either a `HyperApp` (from `app({...})`) or a `Hyper`
 * instance (from `new Hyper()` / `hyper()`). The latter is lowered via
 * `.build()` so tests never need to call it manually.
 */

import { type HttpMethod, Hyper, type HyperApp } from "@usehyper/core"
import { type FakeRequestInit, fakeRequest } from "./request.ts"

export function call(
  app: HyperApp | Hyper,
  method: HttpMethod,
  path: string,
  init: FakeRequestInit = {},
): Promise<Response> {
  const built = app instanceof Hyper ? app.build() : app
  return built.fetch(fakeRequest(method, path, init))
}
