/**
 * Component applier.
 *
 * Takes a fetched `RegistryComponent`, the user's `HyperConfig`, and writes
 * the files into their repo. Handles:
 *
 *   - recursive `registryDeps` resolution (depth-first, deduplicated)
 *   - import rewriting per the user's alias
 *   - sha256-based drift detection: refuse to overwrite locally-modified
 *     files unless `--force` is set
 *   - atomic-ish lockfile updates: in-memory mutation of the lock object,
 *     a single write at the end
 *   - peer-dependency reporting (returned to the caller)
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { HyperConfig, HyperLock, LockedComponent } from "../config/types.ts"
import type { RegistryClient } from "./client.ts"
import { mergeEnvFile } from "./env-writer.ts"
import { resolveTarget, rewriteFile } from "./rewrite.ts"
import type { RegistryComponent, RegistryFile } from "./types.ts"

export interface ApplyOptions {
  readonly cwd: string
  readonly config: HyperConfig
  readonly client: RegistryClient
  readonly lock: HyperLock
  readonly force: boolean
  readonly dryRun: boolean
  /** Pretend each component is at this version (snapshot/CI use case). */
  readonly version?: string
}

export interface ApplyOutcome {
  /** Files written or that would have been written (dry run). */
  readonly written: readonly { path: string; component: string; reason: "new" | "updated" }[]
  /** Files unchanged (already match the registry). */
  readonly unchanged: readonly { path: string; component: string }[]
  /** Files that conflict (local-modified, no --force). */
  readonly conflicts: readonly { path: string; component: string }[]
  /** Components touched, in install order (deps first). */
  readonly components: readonly RegistryComponent[]
  /** Updated lock — caller persists with `writeLock`. */
  readonly lock: HyperLock
  /** Peer deps surfaced after install. */
  readonly peerDeps: Readonly<Record<string, string>>
  readonly optionalPeerDeps: Readonly<Record<string, string>>
  /** Warnings raised by `resolveTarget` (unknown placeholders). */
  readonly warnings: readonly string[]
  /** Env-var changes applied to `.env.local`. */
  readonly envVars: {
    readonly path: string
    readonly added: readonly string[]
    readonly preserved: readonly string[]
  }
}

/**
 * Resolve the full transitive dep set for a list of root components.
 * Returns components in topological order (deps before dependents).
 */
export async function resolveDeps(
  roots: readonly string[],
  client: RegistryClient,
): Promise<RegistryComponent[]> {
  const visited = new Map<string, RegistryComponent>()
  const order: RegistryComponent[] = []
  const visiting = new Set<string>()

  const visit = async (name: string): Promise<void> => {
    if (visited.has(name)) return
    if (visiting.has(name)) {
      throw new Error(`registry cycle detected at ${name}`)
    }
    visiting.add(name)
    const c = await client.getComponent(name)
    for (const d of c.registryDeps) await visit(d)
    visiting.delete(name)
    visited.set(name, c)
    order.push(c)
  }

  for (const r of roots) await visit(r)
  return order
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Apply (or simulate applying) a list of root components.
 *
 * The roots come from the user (`hyper add cors auth-jwt` → `["cors", "auth-jwt"]`).
 * Their transitive deps are resolved automatically.
 */
export async function applyComponents(
  roots: readonly string[],
  opts: ApplyOptions,
): Promise<ApplyOutcome> {
  const components = await resolveDeps(roots, opts.client)
  const subpathsByComponent = new Map(components.map((c) => [c.name, c.subpaths]))

  const written: { path: string; component: string; reason: "new" | "updated" }[] = []
  const unchanged: { path: string; component: string }[] = []
  const conflicts: { path: string; component: string }[] = []
  const peerDeps: Record<string, string> = {}
  const optionalPeerDeps: Record<string, string> = {}
  const warnings: string[] = []

  const componentsByName: Record<string, LockedComponent> = { ...opts.lock.components }

  for (const c of components) {
    Object.assign(peerDeps, c.peerDeps)
    Object.assign(optionalPeerDeps, c.optionalPeerDeps)

    const lockedFiles: { path: string; sha256: string }[] = []

    for (const f of c.files) {
      const resolved = resolveTarget(f, c.name, opts.config.baseDir)
      const relPath = resolved.relPath
      if (resolved.warning) warnings.push(`${c.name}: ${resolved.warning}`)
      const abs = resolve(opts.cwd, relPath)

      const rewritten = resolved.rewriteImports
        ? rewriteFile(f.contents, {
            alias: opts.config.alias,
            targetPath: relPath,
            baseDir: opts.config.baseDir,
            subpathsByComponent,
          })
        : f.contents
      const newHash = await sha256(rewritten)

      const existing = await readIfExists(abs)
      if (existing !== null) {
        const existingHash = await sha256(existing)
        if (existingHash === newHash) {
          unchanged.push({ path: relPath, component: c.name })
          lockedFiles.push({ path: relPath, sha256: newHash })
          continue
        }
        // The file exists and differs.
        const lockedHash = opts.lock.components[c.name]?.files.find(
          (lf) => lf.path === relPath,
        )?.sha256
        const isUpdate = lockedHash === existingHash
        // - isUpdate: matches the lockfile → user hasn't touched it → safe to overwrite as an update.
        // - else:    user-edited file → conflict unless --force.
        if (!isUpdate && !opts.force) {
          conflicts.push({ path: relPath, component: c.name })
          continue
        }
        if (!opts.dryRun) {
          await mkdir(dirname(abs), { recursive: true })
          await writeFile(abs, rewritten)
        }
        written.push({ path: relPath, component: c.name, reason: "updated" })
        lockedFiles.push({ path: relPath, sha256: newHash })
        continue
      }

      // Net-new file.
      if (!opts.dryRun) {
        await mkdir(dirname(abs), { recursive: true })
        await writeFile(abs, rewritten)
      }
      written.push({ path: relPath, component: c.name, reason: "new" })
      lockedFiles.push({ path: relPath, sha256: newHash })
    }

    // Only update the lock entry if no conflicts blocked installs for this component.
    const componentConflicts = conflicts.filter((x) => x.component === c.name)
    if (componentConflicts.length === 0) {
      const entry: LockedComponent = {
        version: opts.version ?? c.version,
        installedAt: new Date().toISOString(),
        alias: opts.config.alias,
        files: lockedFiles.sort((a, b) => a.path.localeCompare(b.path)),
      }
      componentsByName[c.name] = entry
    }
  }

  const lock: HyperLock = {
    schema: 1,
    registryUrl: opts.config.registryUrl,
    components: componentsByName,
  }

  // Collect env vars across the install. First component to declare a key
  // wins; later components see it as "preserved" (idempotent re-runs).
  // Components with conflicts are skipped so a half-applied install doesn't
  // leak secrets.
  const conflictedNames = new Set(conflicts.map((x) => x.component))
  const envVarsToAdd: Record<string, string> = {}
  for (const c of components) {
    if (!c.envVars || conflictedNames.has(c.name)) continue
    for (const [k, v] of Object.entries(c.envVars)) {
      if (!(k in envVarsToAdd)) envVarsToAdd[k] = v
    }
  }
  const envPath = ".env.local"
  const envSummary = await applyEnvVars(opts.cwd, envPath, envVarsToAdd, opts.dryRun)

  return {
    written,
    unchanged,
    conflicts,
    components,
    lock,
    peerDeps,
    optionalPeerDeps,
    warnings,
    envVars: { path: envPath, ...envSummary },
  }
}

async function applyEnvVars(
  cwd: string,
  relPath: string,
  vars: Readonly<Record<string, string>>,
  dryRun: boolean,
): Promise<{ added: readonly string[]; preserved: readonly string[] }> {
  if (Object.keys(vars).length === 0) return { added: [], preserved: [] }
  const abs = resolve(cwd, relPath)
  const existing = (await readIfExists(abs)) ?? ""
  const merge = mergeEnvFile(existing, vars)
  if (!dryRun && merge.added.length > 0) {
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, merge.merged)
  }
  return { added: merge.added, preserved: merge.preserved }
}

/** Read the actual on-disk version of a registry file (for `hyper diff`). */
export async function readLocalFile(
  cwd: string,
  config: HyperConfig,
  componentName: string,
  manifestFile: RegistryFile,
): Promise<string | null> {
  const relPath = resolveTarget(manifestFile, componentName, config.baseDir).relPath
  const abs = resolve(cwd, relPath)
  if (!(await pathExists(abs))) return null
  return await readFile(abs, "utf8")
}
