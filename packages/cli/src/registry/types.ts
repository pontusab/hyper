/**
 * Wire-format types for the Hyper registry. Mirrors `tools/registry-types.ts`
 * one-to-one — kept here so the CLI has zero workspace deps on `tools/`.
 *
 * Anyone can host their own registry by serving JSON in this shape at:
 *   GET <registryUrl>/r/index.json
 *   GET <registryUrl>/r/<name>.json
 *   GET <registryUrl>/r/<name>@<version>.json
 */

export interface RegistryFile {
  readonly path: string
  readonly contents: string
  readonly sha256: string
  /**
   * Optional override for where this file lands in the user's project.
   * Placeholders: `@base/...`, `@root/...`, `@cursor/...`, `~/...`.
   * See `tools/registry-types.ts` for full semantics.
   */
  readonly target?: string
}

export interface RegistryComponent {
  /** JSON Schema URL emitted by the registry — present in HTTP responses. */
  readonly $schema?: string
  readonly name: string
  readonly version: string
  readonly title?: string
  readonly description: string
  readonly readme: string
  readonly registryDeps: readonly string[]
  readonly peerDeps: Readonly<Record<string, string>>
  readonly optionalPeerDeps: Readonly<Record<string, string>>
  readonly files: readonly RegistryFile[]
  readonly subpaths: Readonly<Record<string, string>>
  /**
   * Env vars the component needs at runtime. The CLI appends them to
   * `.env.local` (existing keys preserved). `${random:hex:N}` and
   * `${random:base64:N}` are resolved locally with `crypto.randomBytes`.
   */
  readonly envVars?: Readonly<Record<string, string>>
  /** Markdown blurb printed after `hyper add`. */
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
  /** JSON Schema URL emitted by the registry — present in HTTP responses. */
  readonly $schema?: string
  readonly schema: 1
  readonly generatedAt: string
  readonly source: string
  readonly components: readonly RegistryIndexEntry[]
}
