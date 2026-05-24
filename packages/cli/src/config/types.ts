/**
 * Shapes for `hyper.config.json` (project-level config) and
 * `hyper.lock.json` (per-component install state).
 *
 * Both files live at the project root next to `package.json`.
 */

export interface HyperConfig {
  /** JSON Schema URL — auto-injected, makes editor tooling work. */
  readonly $schema?: string
  /** Base URL of the registry. Default: `https://hyperjs.ai`. */
  readonly registryUrl: string
  /** Where components are written, relative to project root. Default: `src/hyper`. */
  readonly baseDir: string
  /**
   * Import alias for installed components. The string `"relative"` means
   * the CLI will rewrite all `@hyper/*` imports to relative paths instead.
   * Default: `@hyper`.
   */
  readonly alias: string
  /** Reserved for future TSX/JSX-aware components. */
  readonly tsx?: boolean
  /** Optional: pin every install to this exact registry version (CI use case). */
  readonly pinVersions?: boolean
}

export interface LockedFile {
  /** Path relative to project root (already resolved through `baseDir`). */
  readonly path: string
  /** SHA-256 of file contents AS WRITTEN (post import-rewrite). */
  readonly sha256: string
}

export interface LockedComponent {
  readonly version: string
  /** When this component was installed/updated (ISO-8601). */
  readonly installedAt: string
  /** Which alias was used at install time (may differ from current config). */
  readonly alias: string
  /** Files installed by this component, in stable sorted order. */
  readonly files: readonly LockedFile[]
}

export interface HyperLock {
  readonly schema: 1
  readonly registryUrl: string
  readonly components: Readonly<Record<string, LockedComponent>>
}

export const CONFIG_FILENAME = "hyper.config.json"
export const LOCK_FILENAME = "hyper.lock.json"

export const DEFAULT_REGISTRY_URL = "https://hyperjs.ai"
export const DEFAULT_BASE_DIR = "src/hyper"
export const DEFAULT_ALIAS = "@hyper"
export const SCHEMA_URL = "https://hyperjs.ai/schema.json"

export const DEFAULT_CONFIG: HyperConfig = {
  $schema: SCHEMA_URL,
  registryUrl: DEFAULT_REGISTRY_URL,
  baseDir: DEFAULT_BASE_DIR,
  alias: DEFAULT_ALIAS,
}
