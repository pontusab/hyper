/** Public surface for `hyper.config.json` + `hyper.lock.json` IO. */

export type {
  HyperConfig,
  HyperLock,
  LockedComponent,
  LockedFile,
} from "./types.ts"
export {
  CONFIG_FILENAME,
  DEFAULT_ALIAS,
  DEFAULT_BASE_DIR,
  DEFAULT_CONFIG,
  DEFAULT_REGISTRY_URL,
  LOCK_FILENAME,
  SCHEMA_URL,
} from "./types.ts"
export {
  configExists,
  configPath,
  defaultConfig,
  emptyLock,
  lockPath,
  readConfig,
  readLock,
  writeConfig,
  writeLock,
} from "./io.ts"
export { parseJsonc, patchTsConfig, readTsConfig, upsertAlias, writeTsConfig } from "./tsconfig.ts"
export type { TsConfig } from "./tsconfig.ts"
