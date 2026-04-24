/**
 * file() — serve a file from disk via `Bun.file(path)`.
 *
 * Refuses `..` segments by default to prevent path traversal. Users
 * can opt in explicitly when serving from a safely-sandboxed path.
 */

import { HyperError } from "./error.ts"

export interface FileOptions {
  /** Only set this for a path you fully control and sanitize upstream. */
  readonly allowTraversal?: boolean
  /** Optional content-type override; otherwise Bun sniffs from extension. */
  readonly type?: string
}

/**
 * Return a `Bun.file(path)` response helper. The response layer
 * detects the BunFile shape and passes through via `sendfile`.
 */
export function file(path: string, opts: FileOptions = {}): import("bun").BunFile {
  if (!opts.allowTraversal && hasTraversal(path)) {
    throw new HyperError({
      status: 400,
      code: "path_traversal",
      message: "Refusing to serve a path containing '..' segments.",
      why: "Path traversal is a common attack; Hyper rejects it at the file helper.",
      fix: "Pass `allowTraversal: true` only when serving from a sandboxed prefix you control.",
    })
  }
  return Bun.file(path, opts.type ? { type: opts.type } : undefined)
}

function hasTraversal(p: string): boolean {
  // Normalize forward+backslashes.
  const normalized = p.replace(/\\/g, "/")
  for (const seg of normalized.split("/")) {
    if (seg === "..") return true
  }
  return false
}
