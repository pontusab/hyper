/**
 * Load a built HyperApp from a source path.
 *
 * Before importing we set `HYPER_SKIP_LISTEN=1` so that user modules
 * which call `.listen()` on their default export (the canonical
 * `new Hyper().listen(3000)` pattern) do NOT actually boot a socket
 * during CLI introspection. The chain still runs through `.build()`
 * so everything downstream (openapi, routes, mcp, bench) works.
 *
 * The user module can export any of:
 *   - a `Hyper` instance (preferred — lowered via `.build()`)
 *   - a `HyperApp` (the legacy `app({...})` shape)
 *   - a `default` or named `app` export of either shape
 */

import { Hyper, type HyperApp } from "@usehyper/core"

export async function loadApp(entry: string): Promise<HyperApp | null> {
  process.env.HYPER_SKIP_LISTEN = "1"
  const mod = (await import(entry)) as {
    default?: Hyper | HyperApp
    app?: Hyper | HyperApp
  }
  const raw = mod.default ?? mod.app ?? null
  if (!raw) return null
  if (raw instanceof Hyper) return raw.build()
  return raw
}
