#!/usr/bin/env bun
/**
 * Registry sanity-check.
 *
 * Builds every component in memory (without writing anything to disk) and
 * verifies that:
 *
 *   - the dependency graph is closed (every registryDep resolves)
 *   - every declared subpath maps to a file that's actually shipped
 *
 * Used in CI. Manifests themselves are no longer checked into the repo —
 * the website's registry routes generate them on demand at request time and
 * the CDN caches them. See `apps/website/lib/manifests.ts`.
 *
 * Usage:
 *   bun run tools/build-registry.ts            # build + validate, exit non-zero on issues
 *   bun run tools/build-registry.ts --check    # alias for the same; kept for back-compat
 */

import { buildAll, validate } from "./registry/build.ts"

async function main(): Promise<number> {
  const components = await buildAll()
  if (components.length === 0) {
    console.error("error: no components found")
    return 1
  }

  const issues = validate(components)
  for (const issue of issues) {
    if (issue.kind === "missing-dep") {
      console.error(`error: ${issue.message}`)
    } else {
      console.warn(`warning: ${issue.message}`)
    }
  }
  if (issues.some((i) => i.kind === "missing-dep")) return 1

  const fileCount = components.reduce((s, c) => s + c.files.length, 0)
  console.log(`ok: ${components.length} components, ${fileCount} files`)
  for (const c of components) {
    const deps = c.registryDeps.length ? `  ← needs ${c.registryDeps.join(", ")}` : ""
    console.log(`  ${c.name.padEnd(20)} ${String(c.files.length).padStart(3)} files${deps}`)
  }
  return 0
}

main().then((code) => {
  process.exit(code)
})
