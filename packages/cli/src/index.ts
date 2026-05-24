/**
 * @usehyper/cli — programmatic entry for embedding the CLI in scripts/CI.
 *
 * The CLI is also installable as a binary via `bun add -D @usehyper/cli`
 * (exposes the `hyper` executable). Most users won't import this module
 * directly.
 */

export { parseArgs } from "./args.ts"
export type { ParsedArgs } from "./args.ts"

export { runAdd } from "./commands/add.ts"
export { runBuild } from "./commands/build.ts"
export { runDev } from "./commands/dev.ts"
export { runDiff } from "./commands/diff.ts"
export { runEnvCheck } from "./commands/env.ts"
export { runHelp } from "./commands/help.ts"
export { runInit } from "./commands/init.ts"
export { runList } from "./commands/list.ts"
export { runRoutes } from "./commands/routes.ts"
export { runTypecheck } from "./commands/typecheck.ts"
export { runUpdate } from "./commands/update.ts"
export { runVersion } from "./commands/version.ts"

export { resolveEntry } from "./entry.ts"
export { TEMPLATES } from "./templates.ts"

// Config
export type { HyperConfig, HyperLock } from "./config/index.ts"
export {
  CONFIG_FILENAME,
  DEFAULT_ALIAS,
  DEFAULT_BASE_DIR,
  DEFAULT_REGISTRY_URL,
  LOCK_FILENAME,
  defaultConfig,
  readConfig,
  readLock,
  writeConfig,
  writeLock,
} from "./config/index.ts"

// Registry
export {
  applyComponents,
  createRegistryClient,
  RegistryError,
  resolveDeps,
} from "./registry/index.ts"
export type {
  ApplyOptions,
  ApplyOutcome,
  RegistryClient,
  RegistryComponent,
  RegistryFile,
  RegistryIndex,
} from "./registry/index.ts"
