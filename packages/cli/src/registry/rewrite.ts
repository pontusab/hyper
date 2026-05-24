/**
 * File placement and import rewriting at install time.
 *
 * Two responsibilities:
 *
 * 1. `resolveTarget(file, name, baseDir)` decides where a manifest file
 *    lands in the user's project. Honors per-file `target` placeholders
 *    (`@base/`, `@root/`, `@cursor/`, `~/`) and falls back to
 *    `<baseDir>/<componentName>/<rel>` for package-derived files or the
 *    project root for hand-authored ones.
 *
 * 2. `rewriteFile(contents, ctx)` rewrites `@hyper/<x>` imports in source
 *    files to whatever alias the user configured:
 *      alias: "@hyper"      — pass-through (most projects)
 *      alias: "@/lib/hyper" — `@hyper/core` → `@/lib/hyper/core`
 *      alias: "relative"    — `@hyper/core` → computed relative path
 *
 *    Subpath aliases declared by each component (`@hyper/core/bun` →
 *    `core/adapters/bun`) are applied via the `subpathsByComponent` map.
 *
 * Both are pure functions — no I/O.
 */

import { posix } from "node:path"
import type { RegistryFile } from "./types.ts"

const MANIFEST_ALIAS = "@hyper"

/** File extensions whose contents go through `rewriteFile`. */
const REWRITABLE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"])

export interface RewriteContext {
  /** User-configured alias (`@hyper`, `@/lib/hyper`, or `"relative"`). */
  readonly alias: string
  /** Where the file ends up, relative to the project root. Used for relative mode. */
  readonly targetPath: string
  /** Where components are installed, relative to the project root. */
  readonly baseDir: string
  /**
   * Subpath maps for every component being processed in this batch. Lets
   * `@hyper/core/bun` resolve to `core/adapters/bun` (since that's where
   * the file lives in the manifest).
   *
   * Already accounted for in the manifest itself for cross-component refs,
   * but we re-apply for safety in case manifests evolve.
   */
  readonly subpathsByComponent: ReadonlyMap<string, Readonly<Record<string, string>>>
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const REWRITE_PATTERN = new RegExp(
  // Capture: from / import / dynamic-import / triple-slash / require, then quoted spec.
  `((?:from\\s*|import\\s*\\(?\\s*|require\\s*\\(\\s*)["'\`])${escapeRegex(MANIFEST_ALIAS)}\\/([a-z0-9-]+)((?:\\/[^"'\`]+)?)["'\`]`,
  "g",
)

/**
 * Rewrite the contents of one file according to the user's alias choice.
 *
 * Pure function — no I/O.
 */
export function rewriteFile(contents: string, ctx: RewriteContext): string {
  if (ctx.alias === MANIFEST_ALIAS) return contents

  return contents.replace(REWRITE_PATTERN, (_full, prefix: string, pkg: string, sub: string) => {
    const trailingQuote = prefix.slice(-1) // " ' or `
    const subPath = sub ? sub.slice(1) : ""

    // Resolve subpath through the component's map if relevant.
    const resolvedSub = subPath ? (ctx.subpathsByComponent.get(pkg)?.[subPath] ?? subPath) : ""

    if (ctx.alias === "relative") {
      const fileTarget = resolvedSub ? `${pkg}/${resolvedSub}` : `${pkg}/index`
      const absInstalled = posix.join(ctx.baseDir, `${fileTarget}.ts`)
      const fromDir = posix.dirname(toPosix(ctx.targetPath))
      let relPath = posix.relative(fromDir, absInstalled)
      if (!relPath.startsWith(".")) relPath = `./${relPath}`
      return `${prefix}${relPath}${trailingQuote}`
    }

    // Custom alias — `@/lib/hyper`, `~/hyper`, etc.
    const tail = resolvedSub ? `/${pkg}/${resolvedSub}` : `/${pkg}`
    return `${prefix}${ctx.alias}${tail}${trailingQuote}`
  })
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/")
}

export interface ResolvedTarget {
  /** Project-relative path where this file should land. */
  readonly relPath: string
  /**
   * Whether the contents should pass through `rewriteFile` (alias rewriting).
   * False for markdown, JSON, env files, and anything else that isn't source.
   */
  readonly rewriteImports: boolean
  /**
   * Set when the manifest used a placeholder we don't recognize. The CLI
   * surfaces this as a warning and falls back to a literal path.
   */
  readonly warning?: string
}

/**
 * Resolve a manifest file to a project-relative install path.
 *
 * Honors per-file `target` overrides with a small set of placeholders
 * (`@base`, `@root`, `@cursor`, `~`). Unrecognized `@<word>/` prefixes are
 * passed through verbatim with a warning. Falls back to today's behavior
 * when no `target` is set:
 *
 *   - paths starting with `<componentName>/` go under `<baseDir>/`
 *   - anything else is a project-root drop (e.g. `AGENTS.md`)
 */
export function resolveTarget(
  file: RegistryFile,
  componentName: string,
  baseDir: string,
): ResolvedTarget {
  const target = file.target?.trim()
  if (target) {
    const expansion = expandPlaceholder(target, baseDir)
    return {
      relPath: posix.normalize(expansion.path),
      rewriteImports: shouldRewriteByExt(expansion.path),
      ...(expansion.warning !== undefined && { warning: expansion.warning }),
    }
  }
  // Fallback: package-derived files start with `<componentName>/` and live
  // under `<baseDir>/`. Hand-authored files without a target stay at the
  // project root.
  if (file.path.startsWith(`${componentName}/`)) {
    return {
      relPath: posix.join(baseDir, file.path),
      rewriteImports: shouldRewriteByExt(file.path),
    }
  }
  return {
    relPath: file.path,
    rewriteImports: shouldRewriteByExt(file.path),
  }
}

interface PlaceholderExpansion {
  readonly path: string
  readonly warning?: string
}

function expandPlaceholder(target: string, baseDir: string): PlaceholderExpansion {
  if (target.startsWith("@base/"))
    return { path: posix.join(baseDir, target.slice("@base/".length)) }
  if (target === "@base") return { path: baseDir }
  if (target.startsWith("@root/")) return { path: target.slice("@root/".length) }
  if (target.startsWith("~/")) return { path: target.slice(2) }
  if (target.startsWith("@cursor/"))
    return { path: posix.join(".cursor", target.slice("@cursor/".length)) }
  // Unknown placeholder — pass through, warn the caller.
  if (/^@[a-z][a-z0-9_-]*\//i.test(target)) {
    return {
      path: target,
      warning: `Unknown target placeholder in "${target}" — writing to literal path. Known placeholders: @base, @root, @cursor, ~`,
    }
  }
  return { path: target }
}

function shouldRewriteByExt(path: string): boolean {
  const dot = path.lastIndexOf(".")
  if (dot < 0) return false
  const ext = path.slice(dot).toLowerCase()
  return REWRITABLE_EXTS.has(ext)
}
