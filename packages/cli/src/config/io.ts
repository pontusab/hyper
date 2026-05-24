/**
 * Read/write helpers for `hyper.config.json` and `hyper.lock.json`.
 *
 * Behavioral guarantees:
 *   - Reading a missing config file returns the defaults (with `registryUrl`
 *     possibly overridden by the `HYPER_REGISTRY_URL` env var).
 *   - Reading a missing lockfile returns an empty lock — never throws.
 *   - Writes are pretty-printed with 2-space indent + trailing newline so the
 *     files are diff-friendly when checked into source control.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  CONFIG_FILENAME,
  DEFAULT_ALIAS,
  DEFAULT_BASE_DIR,
  DEFAULT_CONFIG,
  DEFAULT_REGISTRY_URL,
  type HyperConfig,
  type HyperLock,
  LOCK_FILENAME,
  type LockedComponent,
  SCHEMA_URL,
} from "./types.ts"

export interface ConfigIO {
  readonly cwd: string
}

export function configPath(cwd: string = process.cwd()): string {
  return resolve(cwd, CONFIG_FILENAME)
}

export function lockPath(cwd: string = process.cwd()): string {
  return resolve(cwd, LOCK_FILENAME)
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    const buf = await readFile(path, "utf8")
    return JSON.parse(buf) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
  }
}

export async function readConfig(cwd: string = process.cwd()): Promise<HyperConfig> {
  const fromDisk = await readJsonOrNull<Partial<HyperConfig>>(configPath(cwd))
  const envUrl = process.env.HYPER_REGISTRY_URL
  return {
    $schema: fromDisk?.$schema ?? SCHEMA_URL,
    registryUrl: envUrl ?? fromDisk?.registryUrl ?? DEFAULT_REGISTRY_URL,
    baseDir: fromDisk?.baseDir ?? DEFAULT_BASE_DIR,
    alias: fromDisk?.alias ?? DEFAULT_ALIAS,
    ...(fromDisk?.tsx !== undefined && { tsx: fromDisk.tsx }),
    ...(fromDisk?.pinVersions !== undefined && { pinVersions: fromDisk.pinVersions }),
  }
}

export async function writeConfig(config: HyperConfig, cwd: string = process.cwd()): Promise<void> {
  const path = configPath(cwd)
  const ordered: HyperConfig = {
    $schema: config.$schema ?? SCHEMA_URL,
    registryUrl: config.registryUrl,
    baseDir: config.baseDir,
    alias: config.alias,
    ...(config.tsx !== undefined && { tsx: config.tsx }),
    ...(config.pinVersions !== undefined && { pinVersions: config.pinVersions }),
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(ordered, null, 2)}\n`)
}

export async function configExists(cwd: string = process.cwd()): Promise<boolean> {
  return (await readJsonOrNull(configPath(cwd))) !== null
}

export function emptyLock(registryUrl: string = DEFAULT_REGISTRY_URL): HyperLock {
  return { schema: 1, registryUrl, components: {} }
}

export async function readLock(cwd: string = process.cwd()): Promise<HyperLock> {
  const fromDisk = await readJsonOrNull<HyperLock>(lockPath(cwd))
  if (!fromDisk) return emptyLock()
  return fromDisk
}

export async function writeLock(lock: HyperLock, cwd: string = process.cwd()): Promise<void> {
  const path = lockPath(cwd)
  await mkdir(dirname(path), { recursive: true })
  // Sort keys deterministically so lockfile diffs are minimal.
  const sortedComponents: Record<string, LockedComponent> = {}
  for (const name of Object.keys(lock.components).sort()) {
    sortedComponents[name] = lock.components[name]!
  }
  const ordered: HyperLock = {
    schema: lock.schema,
    registryUrl: lock.registryUrl,
    components: sortedComponents,
  }
  await writeFile(path, `${JSON.stringify(ordered, null, 2)}\n`)
}

/** Default config with optional overrides for `hyper init`. */
export function defaultConfig(overrides: Partial<HyperConfig> = {}): HyperConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  }
}
