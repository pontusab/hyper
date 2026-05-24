/**
 * Shared registry manifest types — used by the build tool, the CLI client,
 * and the registry service. Single source of truth for the wire shape.
 *
 * The wire format is a stable contract: anyone can host their own registry
 * by serving JSON in this shape at predictable URLs (`/r/index.json`,
 * `/r/<name>.json`, `/r/<name>@<version>.json`).
 */

export interface RegistryFile {
  /**
   * Path relative to the component's install root (`<baseDir>/<component>/`).
   * Used as a stable identifier when no `target` is set.
   */
  readonly path: string
  /** Verbatim file contents with imports already rewritten to the alias placeholder. */
  readonly contents: string
  /** SHA-256 of `contents`. Used by `hyper diff` and the lockfile. */
  readonly sha256: string
  /**
   * Optional override for where this file lands in the user's project.
   *
   * Supports a small set of placeholders, expanded at install time:
   *   `@base/<rel>`     -> `<baseDir>/<rel>`         (default for component source)
   *   `@root/<rel>`     -> `<rel>`                   (project root, e.g. AGENTS.md)
   *   `@cursor/<rel>`   -> `.cursor/<rel>`           (editor rules)
   *   `~/<rel>`         -> `<rel>`                   (project root; alias of @root)
   *
   * Anything else is treated as a literal project-relative path. Unknown
   * `@<word>/...` placeholders are passed through verbatim with a CLI
   * warning.
   *
   * If absent, falls back to the default placement
   * (`<baseDir>/<componentName>/<file.path>` for component-prefixed paths,
   * or project-root for non-prefixed hand-authored paths).
   */
  readonly target?: string
}

export interface RegistryComponent {
  /** JSON Schema URL — populated by the build tool for IDE validation. */
  readonly $schema?: string
  readonly name: string
  readonly version: string
  /**
   * Human-readable display name. Used by the browse UI, MCP tool output, and
   * the CLI's `list` / `--info` views. Optional; falls back to `name`.
   */
  readonly title?: string
  readonly description: string
  /** Full README markdown. May be empty when no README exists for the component. */
  readonly readme: string
  /** Other registry components this one depends on (transitively resolved on install). */
  readonly registryDeps: readonly string[]
  /** npm peer deps (`zod`, `drizzle-orm`, …). Surfaced after install. */
  readonly peerDeps: Readonly<Record<string, string>>
  /** Optional peer deps. CLI prints them as "optional" hints. */
  readonly optionalPeerDeps: Readonly<Record<string, string>>
  /** All files copied into the user's repo, relative to `<baseDir>/<component>/`. */
  readonly files: readonly RegistryFile[]
  /** Subpath aliases (e.g. `@hyper/core/bun` → `core/adapters/bun`). */
  readonly subpaths: Readonly<Record<string, string>>
  /**
   * Env vars the component needs at runtime. Values are example placeholders
   * appended to `.env.local` on install (existing keys preserved verbatim,
   * making re-runs idempotent).
   *
   * The CLI resolves a small set of `${...}` interpolations LOCALLY (so
   * secrets never leave the user's machine):
   *   `${random:hex:N}`     -> N-byte hex string (use for SESSION_SECRET, JWT_SECRET, …)
   *   `${random:base64:N}`  -> N-byte base64 string
   * Any other `${...}` form is written through verbatim and treated as the
   * user's responsibility to fill in.
   */
  readonly envVars?: Readonly<Record<string, string>>
  /**
   * Markdown blurb printed by the CLI after `hyper add` succeeds. Setup
   * notes, security caveats, links to docs. Keep it short — full reference
   * documentation belongs in the README.
   */
  readonly docs?: string
}

export interface RegistryIndexEntry {
  readonly name: string
  readonly version: string
  readonly title?: string
  readonly description: string
  readonly registryDeps: readonly string[]
  readonly fileCount: number
}

export interface RegistryIndex {
  /** JSON Schema URL — populated by the build tool for IDE validation. */
  readonly $schema?: string
  /** Schema version for the index format itself. */
  readonly schema: 1
  /** When this snapshot was generated (ISO-8601). */
  readonly generatedAt: string
  /** Source repo, useful for `hyper diff` to link to upstream files. */
  readonly source: string
  readonly components: readonly RegistryIndexEntry[]
}
