#!/usr/bin/env bun
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
/**
 * native-only-check: fails if any @usehyper/core package depends on a
 * userland substitute for a Bun primitive.
 *
 * The rule: @usehyper/core must not import from (or depend on) any of the
 * banned packages. Other packages may use them only for interop shims.
 */
import { Glob } from "bun"

const BANNED = new Set([
  // Cookies
  "cookie",
  "set-cookie-parser",
  // Password
  "argon2",
  "bcrypt",
  "bcryptjs",
  // Compression
  "pako",
  "zlib",
  // Routing
  "find-my-way",
  "@medley/router",
  "koa-router",
  // Hashing
  "md5",
  "object-hash",
  // Semver
  "semver",
  // Escape HTML
  "escape-html",
  // Deep equals
  "lodash.isequal",
  "fast-deep-equal",
])

// Subset of packages the rule applies to strictly (core must be pristine).
const STRICT_PACKAGES = new Set(["@usehyper/core"])

const root = resolve(import.meta.dir, "..")
const glob = new Glob("packages/*/package.json")

let failed = false

for await (const rel of glob.scan(root)) {
  const path = resolve(root, rel)
  const pkg = JSON.parse(await readFile(path, "utf8")) as {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
  if (!pkg.name) continue
  const deps = {
    ...pkg.dependencies,
    ...pkg.peerDependencies,
    // devDeps exempt (test-only may need interop packages)
  }
  for (const dep of Object.keys(deps)) {
    if (BANNED.has(dep)) {
      console.error(
        `✗ ${pkg.name} depends on banned userland substitute "${dep}". Use the Bun primitive instead.`,
      )
      failed = true
    }
  }
  if (STRICT_PACKAGES.has(pkg.name)) {
    // Core must have zero runtime deps.
    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      console.error(
        `✗ ${pkg.name} must have zero runtime dependencies. Found: ${Object.keys(pkg.dependencies).join(", ")}`,
      )
      failed = true
    }
  }
}

if (failed) {
  console.error("\nnative-only check failed. See above.")
  process.exit(1)
}

console.log("✓ native-only check passed.")
