/** Public surface for the registry client + applier. */

export {
  applyComponents,
  readLocalFile,
  resolveDeps,
} from "./apply.ts"
export type { ApplyOptions, ApplyOutcome } from "./apply.ts"
export { createRegistryClient, RegistryError } from "./client.ts"
export type { RegistryClient, RegistryClientOptions } from "./client.ts"
export { resolveTarget, rewriteFile } from "./rewrite.ts"
export { SNAPSHOT_COMPONENTS, SNAPSHOT_INDEX } from "./snapshot.ts"
export type {
  RegistryComponent,
  RegistryFile,
  RegistryIndex,
  RegistryIndexEntry,
} from "./types.ts"
