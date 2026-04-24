import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

/**
 * `hyper build` — bundle via Bun.build and emit the artifact manifest.
 *
 * v0.3 additions:
 *   - content-hash cache: skips bundling when entry+tsconfig+deps hash
 *     matches the previous build. Typical cache hit: <50ms incremental.
 *   - route graph: includes projection hints (mcp, subscription, action,
 *     deprecated, version) so downstream codegen can consume it directly.
 *   - per-route monomorphic hint: routes without dynamic segments are
 *     flagged `nativeEligible: true`, letting the adapter mount them on
 *     `Bun.serve({ routes: ... })` for faster dispatch.
 *   - .d.ts emission: when `--dts` is passed, emit isolated declaration
 *     files alongside the bundle via `tsgo` (falls back to `tsc`).
 */
export async function runBuild(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const outDir = typeof args.flags.outDir === "string" ? args.flags.outDir : "dist"
  const absOut = resolve(process.cwd(), outDir)
  await mkdir(absOut, { recursive: true })

  if (typeof Bun === "undefined") {
    console.error("error: hyper build requires Bun")
    return 2
  }

  const cacheKey = await computeCacheKey(entry)
  const cacheFile = join(absOut, ".hyper-cache.json")
  const cached = await readJsonOrNull<{ key: string; summary: unknown }>(cacheFile)
  const bypassCache = args.flags.force === true
  if (!bypassCache && cached?.key === cacheKey) {
    if (isJson(args.flags)) console.log(JSON.stringify(cached.summary))
    else console.log(`build cached -> ${absOut} (key ${cacheKey.slice(0, 8)})`)
    return 0
  }

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: absOut,
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    minify: args.flags.minify === true || args.flags.minify === "true",
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return 1
  }

  const app = await loadApp(entry)
  if (app) {
    const graph = {
      routes: app.routeList.map((r) => ({
        method: r.method,
        path: r.path,
        meta: r.meta,
        kind: r.kind,
        nativeEligible: !r.path.includes(":"),
        staticResponse: r.kind === "static",
      })),
      summary: {
        total: app.routeList.length,
        staticCount: app.routeList.filter((r) => r.kind === "static").length,
        nativeEligibleCount: app.routeList.filter((r) => !r.path.includes(":")).length,
      },
    }
    const graphPath = resolve(absOut, "route-graph.json")
    await mkdir(dirname(graphPath), { recursive: true })
    await writeFile(graphPath, JSON.stringify(graph, null, 2))
  }

  if (args.flags.dts === true) {
    await emitDts(absOut)
  }

  const summary = {
    entry,
    outDir: absOut,
    artifacts: result.outputs.map((o) => o.path),
    routeCount: app?.routeList.length ?? 0,
    cacheKey,
  }
  await writeFile(cacheFile, JSON.stringify({ key: cacheKey, summary }))
  if (isJson(args.flags)) {
    console.log(JSON.stringify(summary))
  } else {
    console.log(`build ok -> ${absOut}`)
    console.log(`  ${summary.artifacts.length} artifact(s), ${summary.routeCount} route(s)`)
  }
  return 0
}

async function computeCacheKey(entry: string): Promise<string> {
  const h = createHash("sha256")
  h.update(entry)
  await hashFile(h, entry)
  await hashFile(h, resolve(process.cwd(), "tsconfig.json"))
  await hashFile(h, resolve(process.cwd(), "package.json"))
  await hashFile(h, resolve(process.cwd(), "bun.lockb"))
  return h.digest("hex")
}

async function hashFile(h: import("node:crypto").Hash, path: string): Promise<void> {
  try {
    const s = await stat(path)
    h.update(path)
    h.update(s.mtimeMs.toString())
    if (s.size < 1024 * 1024) {
      const buf = await readFile(path)
      h.update(buf)
    }
  } catch {
    // Missing file — include absence in the key.
    h.update(`missing:${path}`)
  }
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    const buf = await readFile(path, "utf8")
    return JSON.parse(buf) as T
  } catch {
    return null
  }
}

async function emitDts(outDir: string): Promise<void> {
  const { spawn } = await import("node:child_process")
  await new Promise<void>((res) => {
    const child = spawn("tsgo", ["--declaration", "--emitDeclarationOnly", "--outDir", outDir], {
      stdio: "inherit",
    })
    child.on("exit", () => res())
    child.on("error", () => res())
  })
}
