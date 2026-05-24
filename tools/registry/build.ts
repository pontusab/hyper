/**
 * In-memory registry builder.
 *
 * This is the single source of truth for "what does the Hyper registry contain
 * and what does each manifest look like". Three callers consume it:
 *
 *   - `apps/registry/src/manifests.ts`    — serves manifests dynamically at runtime
 *   - `tools/build-cli-snapshot.ts`       — bakes a snapshot into the CLI tarball
 *   - `tools/build-registry.ts --check`   — CI sanity check (ensures the graph is valid)
 *
 * No JSON files are ever written by this module. It walks `packages/*` plus the
 * hand-authored `packages/cli/registry-sources/*` directories, normalizes any
 * `@hyper/<x>/<sub>` import subpaths against each package's `exports` map, and
 * returns a fully-hydrated `RegistryComponent[]`.
 *
 * Tests, benches, and fuzz files are excluded.
 */

import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import type { RegistryComponent, RegistryFile, RegistryIndex } from "../registry-types.ts"

const ROOT = resolve(import.meta.dir, "../..")
const PACKAGES_DIR = join(ROOT, "packages")
const HAND_AUTHORED_DIR = join(ROOT, "packages/cli/registry-sources")

const SKIP_PACKAGES = new Set(["cli", "create-hyper"])
const NPM_SCOPE = "@hyper"
const DEFAULT_ALIAS = "@hyper"
const TEST_SEGMENTS = new Set(["__tests__", "__bench__", "__fuzz__"])
const TEST_SUFFIXES = [".test.ts", ".test-d.ts", ".bench.ts", ".fuzz.test.ts", ".fuzz.ts"]

interface PackageJsonExport {
  readonly types?: string
  readonly import?: string
  readonly default?: string
}
/**
 * Optional `hyper` field in each `packages/<x>/package.json` carries registry
 * metadata that has no place in npm's schema (title, env vars, post-install
 * docs). Hand-authored components ship the same fields in `manifest.json`.
 */
interface PackageJsonHyperField {
  readonly title?: string
  readonly envVars?: Record<string, string>
  readonly docs?: string
}

interface PackageJson {
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly exports?: Record<string, PackageJsonExport | string>
  readonly peerDependencies?: Record<string, string>
  readonly peerDependenciesMeta?: Record<string, { optional?: boolean }>
  readonly hyper?: PackageJsonHyperField
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await readFile(p, "utf8")) as T
}

async function readText(p: string): Promise<string> {
  return await readFile(p, "utf8")
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function walkSrc(dir: string, srcRoot: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const abs = join(dir, e.name)
    if (e.isDirectory()) {
      if (TEST_SEGMENTS.has(e.name)) continue
      await walkSrc(abs, srcRoot, out)
      continue
    }
    if (!e.isFile()) continue
    if (!e.name.endsWith(".ts") && !e.name.endsWith(".md")) continue
    if (TEST_SUFFIXES.some((s) => e.name.endsWith(s))) continue
    out.push(abs)
  }
  return out
}

function buildSubpathMap(pkg: PackageJson): Record<string, string> {
  const map: Record<string, string> = {}
  if (!pkg.exports) return map
  for (const [key, value] of Object.entries(pkg.exports)) {
    if (key === ".") continue
    const sub = key.startsWith("./") ? key.slice(2) : key
    const target = typeof value === "string" ? value : (value.import ?? value.default)
    if (!target) continue
    const stripped = target
      .replace(/^\.\//, "")
      .replace(/^src\//, "")
      .replace(/\.ts$/, "")
    if (stripped !== sub) {
      map[sub] = stripped
    }
  }
  return map
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Normalize `@hyper/<x>/<sub>` import subpaths against each package's
 * `exports` map. Pure `@hyper/<x>` imports pass through unchanged.
 */
function rewriteImports(
  src: string,
  subpathsByComponent: Map<string, Record<string, string>>,
  alias: string = DEFAULT_ALIAS,
): string {
  const aliasEsc = escapeRegex(alias)
  const pattern = new RegExp(`${aliasEsc}\\/([a-z0-9-]+)\\/([^"'\\s\`]+)`, "g")
  return src.replace(pattern, (_match, pkg: string, sub: string) => {
    const subMap = subpathsByComponent.get(pkg)
    if (subMap && Object.prototype.hasOwnProperty.call(subMap, sub)) {
      return `${alias}/${pkg}/${subMap[sub]}`
    }
    return `${alias}/${pkg}/${sub}`
  })
}

/**
 * Real ES module imports only (`from "spec"`, `import "spec"`, `import("spec")`).
 * JSDoc and string mentions are skipped.
 */
function deriveRegistryDeps(files: readonly RegistryFile[], self: string): string[] {
  const deps = new Set<string>()
  const aliasEsc = escapeRegex(DEFAULT_ALIAS)
  const pattern = new RegExp(
    `(?:from\\s*|import\\s*\\(?\\s*)["'\`]${aliasEsc}\\/([a-z0-9-]+)(?:\\/[^"'\`]+)?["'\`]`,
    "g",
  )
  for (const f of files) {
    for (const m of f.contents.matchAll(pattern)) {
      const pkg = m[1]
      if (pkg && pkg !== self) deps.add(pkg)
    }
  }
  return [...deps].sort()
}

function srcToComponentPath(absFile: string, srcRoot: string): string {
  return relative(srcRoot, absFile)
}

interface MetaFields {
  title?: string
  envVars?: Readonly<Record<string, string>>
  docs?: string
}

/**
 * Spread helper for the optional registry-meta fields (`title`, `envVars`,
 * `docs`). Both package- and hand-authored components carry these in
 * structurally identical shapes, so the merge logic is centralized here.
 */
function metaFields(meta: MetaFields): MetaFields {
  const out: MetaFields = {}
  if (meta.title !== undefined) out.title = meta.title
  if (meta.envVars !== undefined) out.envVars = meta.envVars
  if (meta.docs !== undefined) out.docs = meta.docs
  return out
}

interface BuildContext {
  readonly subpathsByComponent: Map<string, Record<string, string>>
}

async function buildPackageComponent(
  pkgDir: string,
  ctx: BuildContext,
): Promise<RegistryComponent | null> {
  const pkgJsonPath = join(pkgDir, "package.json")
  if (!(await exists(pkgJsonPath))) return null
  const pkg = await readJson<PackageJson>(pkgJsonPath)
  if (!pkg.name?.startsWith(`${NPM_SCOPE}/`)) return null

  const componentName = pkg.name.slice(NPM_SCOPE.length + 1)
  if (SKIP_PACKAGES.has(componentName)) return null

  const srcRoot = join(pkgDir, "src")
  if (!(await exists(srcRoot))) return null

  const allFiles = await walkSrc(srcRoot, srcRoot)
  const sourceFiles = allFiles.filter((f) => f.endsWith(".ts"))

  const files: RegistryFile[] = []
  for (const abs of sourceFiles) {
    const raw = await readText(abs)
    const rewritten = rewriteImports(raw, ctx.subpathsByComponent)
    const rel = srcToComponentPath(abs, srcRoot)
    files.push({
      path: `${componentName}/${rel}`,
      contents: rewritten,
      sha256: await sha256(rewritten),
    })
  }
  files.sort((a, b) => a.path.localeCompare(b.path))

  const readmePath = join(pkgDir, "README.md")
  const readme = (await exists(readmePath))
    ? rewriteImports(await readText(readmePath), ctx.subpathsByComponent)
    : ""

  const peerDeps: Record<string, string> = {}
  const optionalPeerDeps: Record<string, string> = {}
  for (const [k, v] of Object.entries(pkg.peerDependencies ?? {})) {
    if (k.startsWith(`${NPM_SCOPE}/`)) continue
    if (pkg.peerDependenciesMeta?.[k]?.optional) {
      optionalPeerDeps[k] = v
    } else {
      peerDeps[k] = v
    }
  }

  return {
    name: componentName,
    version: pkg.version,
    description: pkg.description ?? "",
    readme,
    registryDeps: deriveRegistryDeps(files, componentName),
    peerDeps,
    optionalPeerDeps,
    files,
    subpaths: buildSubpathMap(pkg),
    ...metaFields(pkg.hyper ?? {}),
  }
}

interface HandAuthoredManifest {
  readonly name: string
  readonly version: string
  readonly title?: string
  readonly description?: string
  readonly registryDeps?: readonly string[]
  readonly peerDeps?: Record<string, string>
  readonly optionalPeerDeps?: Record<string, string>
  readonly subpaths?: Record<string, string>
  readonly envVars?: Record<string, string>
  readonly docs?: string
  /** Per-file overrides keyed by `path` relative to `files/`. */
  readonly files?: ReadonlyArray<{ readonly path: string; readonly target?: string }>
}

async function buildHandAuthoredComponent(
  componentDir: string,
  ctx: BuildContext,
): Promise<RegistryComponent | null> {
  const manifestPath = join(componentDir, "manifest.json")
  if (!(await exists(manifestPath))) return null
  const manifest = await readJson<HandAuthoredManifest>(manifestPath)

  // `target` overrides keyed by relative file path. The manifest is the
  // authoritative source for placement; the on-disk `files/` directory
  // only supplies contents.
  const targetByPath = new Map<string, string>()
  for (const entry of manifest.files ?? []) {
    if (entry.target) targetByPath.set(entry.path, entry.target)
  }

  const filesRoot = join(componentDir, "files")
  const files: RegistryFile[] = []
  if (await exists(filesRoot)) {
    const stack: string[] = [filesRoot]
    while (stack.length > 0) {
      const cur = stack.pop()!
      const entries = await readdir(cur, { withFileTypes: true })
      for (const e of entries) {
        const abs = join(cur, e.name)
        if (e.isDirectory()) {
          stack.push(abs)
          continue
        }
        if (!e.isFile()) continue
        const rel = relative(filesRoot, abs)
        const raw = await readText(abs)
        const rewritten = rewriteImports(raw, ctx.subpathsByComponent)
        const target = targetByPath.get(rel)
        files.push({
          path: rel,
          contents: rewritten,
          sha256: await sha256(rewritten),
          ...(target !== undefined && { target }),
        })
      }
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path))

  const readmePath = join(componentDir, "README.md")
  const readme = (await exists(readmePath))
    ? rewriteImports(await readText(readmePath), ctx.subpathsByComponent)
    : ""

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? "",
    readme,
    registryDeps: manifest.registryDeps ?? [],
    peerDeps: manifest.peerDeps ?? {},
    optionalPeerDeps: manifest.optionalPeerDeps ?? {},
    files,
    subpaths: manifest.subpaths ?? {},
    ...metaFields(manifest),
  }
}

async function loadSubpathMaps(): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>()
  const dirs = await readdir(PACKAGES_DIR, { withFileTypes: true })
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const pkgPath = join(PACKAGES_DIR, d.name, "package.json")
    if (!(await exists(pkgPath))) continue
    const pkg = await readJson<PackageJson>(pkgPath)
    if (!pkg.name?.startsWith(`${NPM_SCOPE}/`)) continue
    const componentName = pkg.name.slice(NPM_SCOPE.length + 1)
    if (SKIP_PACKAGES.has(componentName)) continue
    map.set(componentName, buildSubpathMap(pkg))
  }
  return map
}

/**
 * Build every registry component in memory. Returns components sorted by name.
 *
 * This is intentionally pure: no caching, no IO beyond reading source files.
 * Callers (the registry server, the CLI snapshot script) decide their own
 * cache strategy on top.
 */
export async function buildAll(): Promise<RegistryComponent[]> {
  const subpathsByComponent = await loadSubpathMaps()
  const ctx: BuildContext = { subpathsByComponent }
  const components: RegistryComponent[] = []

  const pkgDirs = await readdir(PACKAGES_DIR, { withFileTypes: true })
  for (const d of pkgDirs) {
    if (!d.isDirectory()) continue
    const c = await buildPackageComponent(join(PACKAGES_DIR, d.name), ctx)
    if (c) components.push(c)
  }

  if (await exists(HAND_AUTHORED_DIR)) {
    const handDirs = await readdir(HAND_AUTHORED_DIR, { withFileTypes: true })
    for (const d of handDirs) {
      if (!d.isDirectory()) continue
      const c = await buildHandAuthoredComponent(join(HAND_AUTHORED_DIR, d.name), ctx)
      if (c) components.push(c)
    }
  }

  components.sort((a, b) => a.name.localeCompare(b.name))
  return components
}

export function buildIndex(components: readonly RegistryComponent[]): RegistryIndex {
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    source: "https://github.com/pontusab/hyper",
    components: components.map((c) => ({
      name: c.name,
      version: c.version,
      description: c.description,
      registryDeps: c.registryDeps,
      fileCount: c.files.length,
      ...(c.title !== undefined && { title: c.title }),
    })),
  }
}

export {
  HYPER_CONFIG_SCHEMA,
  HYPER_CONFIG_SCHEMA_URL,
  REGISTRY_INDEX_SCHEMA,
  REGISTRY_INDEX_SCHEMA_URL,
  REGISTRY_ITEM_SCHEMA,
  REGISTRY_ITEM_SCHEMA_URL,
} from "./schema.ts"

export interface RegistryValidationIssue {
  readonly component: string
  readonly kind: "missing-dep" | "subpath-target"
  readonly message: string
}

/**
 * Sanity-check the built component graph: every registryDep resolves, every
 * declared subpath maps to a file we actually shipped.
 */
export function validate(components: readonly RegistryComponent[]): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = []
  const known = new Set(components.map((c) => c.name))
  for (const c of components) {
    for (const d of c.registryDeps) {
      if (!known.has(d)) {
        issues.push({
          component: c.name,
          kind: "missing-dep",
          message: `${c.name} depends on missing component: ${d}`,
        })
      }
    }
    const fileSet = new Set(
      c.files.map((f) => f.path.slice(c.name.length + 1).replace(/\.ts$/, "")),
    )
    for (const [sub, target] of Object.entries(c.subpaths)) {
      if (!fileSet.has(target)) {
        issues.push({
          component: c.name,
          kind: "subpath-target",
          message: `${c.name} subpath "${sub}" -> "${target}" does not match any included file`,
        })
      }
    }
  }
  return issues
}
