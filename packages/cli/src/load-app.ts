/**
 * Load a built HyperApp from a source path.
 *
 * Before importing we set `HYPER_SKIP_LISTEN=1` so user modules that call
 * `.listen()` on their default export don't actually boot a socket during
 * CLI introspection. The chain still runs through `.build()` so everything
 * downstream (openapi, routes, mcp, bench) works.
 *
 * The user module can export any of:
 *   - a `Hyper` instance (preferred — lowered via `.build()`)
 *   - a `HyperApp` (the legacy `app({...})` shape)
 *   - a `default` or named `app` export of either shape
 *
 * We deliberately duck-type rather than `import { Hyper }` so the CLI has
 * no hard runtime dependency on `@hyper/core` — the user's local copy
 * lives at `<baseDir>/core/` and is reached via tsconfig path resolution
 * from their entry file.
 */

import { resolve } from "node:path"
import { readConfig } from "./config/index.ts"

/**
 * Type-only stand-in. The real shape comes from the user's `@hyper/core`.
 * We keep the import as `import type` so it's erased by Bun at runtime.
 */
import type { HyperApp } from "@hyper/core"

interface DuckHyper {
  build(): HyperApp
}

function isDuckHyper(x: unknown): x is DuckHyper {
  return (
    typeof x === "object" &&
    x !== null &&
    "build" in x &&
    typeof (x as { build: unknown }).build === "function"
  )
}

function isDuckHyperApp(x: unknown): x is HyperApp {
  return (
    typeof x === "object" &&
    x !== null &&
    "fetch" in x &&
    typeof (x as { fetch: unknown }).fetch === "function" &&
    "routeList" in x &&
    Array.isArray((x as { routeList: unknown }).routeList)
  )
}

export async function loadApp(entry: string): Promise<HyperApp | null> {
  process.env.HYPER_SKIP_LISTEN = "1"
  const mod = (await import(entry)) as {
    default?: unknown
    app?: unknown
  }
  const raw = mod.default ?? mod.app ?? null
  if (raw === null) return null
  if (isDuckHyper(raw)) return raw.build()
  if (isDuckHyperApp(raw)) return raw
  return null
}

/**
 * Resolve a Hyper component module from the user's local install (preferred)
 * or fall back to a workspace-resolved import (monorepo dev case).
 *
 * `name` is a registry component name (`"openapi"`, `"mcp"`, `"client"`, …).
 *
 * Resolution order:
 *   1. `<cwd>/<baseDir>/<name>/index.ts`  (user's installed copy)
 *   2. `@hyper/<name>`                    (workspace dev, or user's tsconfig alias)
 *
 * Returns `null` if neither works.
 */
export async function loadComponentModule<T>(name: string): Promise<T | null> {
  const config = await readConfig()
  const local = resolve(process.cwd(), config.baseDir, name, "index.ts")
  for (const spec of [local, `@hyper/${name}`]) {
    try {
      return (await import(spec)) as T
    } catch {
      // try next
    }
  }
  return null
}
