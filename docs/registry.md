# Registry & CLI

Hyper is distributed as a component registry, not as npm dependencies.
The CLI (`@usehyper/cli`, an npm package) fetches manifests from a
registry, rewrites imports to your project's alias, and copies the
source into your repo. You own the files.

## Quickstart

```bash
bun add -D @usehyper/cli
hyper init my-app --template api
cd my-app
bun install
bun run dev
```

`hyper init` writes:

- `src/app.ts`, `src/hyper/core/*.ts`, `src/hyper/log/*.ts` (auto-installed)
- `tsconfig.json` patched with `paths: { "@hyper/*": [...] }`
- `hyper.config.json` — registry URL + base directory + alias
- `hyper.lock.json` — per-file SHA-256 of installed components
- `package.json` with **no** `@usehyper/*` runtime deps

Then:

```bash
hyper add cors auth-jwt           # transitive deps resolved
hyper diff log                    # inspect drift before pulling updates
hyper update                      # bump installed components to latest
hyper add --info session          # show readme/files/deps without installing
hyper list redis                  # search the catalog
```

## Configuration: `hyper.config.json`

```json
{
  "$schema": "https://hyperjs.ai/schema.json",
  "registryUrl": "https://hyperjs.ai",
  "baseDir": "src/hyper",
  "alias": "@hyper",
  "tsx": false
}
```

| field         | default              | meaning                                                                  |
| ------------- | -------------------- | ------------------------------------------------------------------------ |
| `registryUrl` | `https://hyperjs.ai` | Base URL. Override with `HYPER_REGISTRY_URL` env var.                    |
| `baseDir`     | `src/hyper`          | Where components are installed, relative to project root.                |
| `alias`       | `@hyper`             | Import alias. Use `"relative"` to rewrite imports to relative paths.     |
| `tsx`         | `false`              | Reserved.                                                                |

Switch to a custom alias:

```json
{ "baseDir": "src/lib/hyper", "alias": "@/lib/hyper" }
```

The CLI re-rewrites every install accordingly — `import { ok } from "@hyper/core"`
in the manifest becomes `import { ok } from "@/lib/hyper/core"` on disk.

## Lockfile: `hyper.lock.json`

```json
{
  "schema": 1,
  "registryUrl": "https://hyperjs.ai",
  "components": {
    "core": {
      "version": "0.1.0",
      "installedAt": "2026-05-24T08:58:45.541Z",
      "alias": "@hyper",
      "files": [
        { "path": "src/hyper/core/index.ts", "sha256": "…" },
        { "path": "src/hyper/core/app.ts", "sha256": "…" }
      ]
    }
  }
}
```

`hyper diff` compares each installed file's content-hash to:

- the lockfile (to detect *local edits*) and
- the registry (to detect *upstream updates*).

`hyper update` only overwrites files that are clean against the
lockfile. Edited files are reported as conflicts unless you pass
`--force`. Always commit before `--force`.

## CLI commands

### `hyper init [template]`

Templates: `minimal`, `api`. Skips files that already exist; never
clobbers. Auto-runs `hyper add <components>` for the template's
component set.

Flags:

- `--dir <path>` — target directory (default `.`)
- `--no-install` — skip auto-installing components
- `--agent-rules` — also install the `agent-rules` component
- `--json`

### `hyper add <component>...`

Resolves each component's transitive `registryDeps`, fetches manifests,
rewrites imports per `hyper.config.json` `alias`, writes files into
`<baseDir>/<component>/`. Updates `hyper.lock.json`.

Flags:

- `--force` — overwrite locally-modified files
- `--dry-run` — show what would change, write nothing
- `--info` — print readme + files + deps for each component, install nothing
- `--list` — list the entire registry catalog
- `--json`

### `hyper diff <component>`

Shows per-file status:

- `ok` — local matches registry
- `drift` — local differs (with line diff)
- `missing` — file isn't installed

Exits non-zero on any drift, useful as a CI gate.

### `hyper update [component...]`

For each installed component, fetches the latest manifest. If the
version is newer, re-applies (subject to drift protection). Without
positionals, updates everything in the lockfile.

### `hyper list [query]` / `hyper search <query>`

Prints the registry index. Substring filter on name, description, deps.
`--json` for machine output.

## Manifest format (the wire contract)

Every component is one JSON file at:

```
<registryUrl>/r/<name>.json              # latest alias (mutable)
<registryUrl>/r/<name>@<version>.json    # immutable
<registryUrl>/r/index.json               # catalog
<registryUrl>/schema.json                # JSON Schema for hyper.config.json (alias)
<registryUrl>/schema/hyper-config.json   # JSON Schema for hyper.config.json
<registryUrl>/schema/registry-item.json  # JSON Schema for component manifests
<registryUrl>/schema/registry.json       # JSON Schema for the index
```

Manifest shape:

```ts
interface RegistryComponent {
  $schema?: string             // "https://hyperjs.ai/schema/registry-item.json"
  name: string                 // "core" | "cors" | "log" | …
  version: string              // "0.1.0"
  title?: string               // human-readable display name (browse UI, MCP, list)
  description: string          // short, for the catalog table
  readme: string               // full README markdown — powers `add --info`
  registryDeps: string[]       // transitive deps, e.g. ["core"]
  peerDeps:           Record<string, string>  // npm deps the user must install
  optionalPeerDeps:   Record<string, string>
  subpaths:           Record<string, string>  // e.g. {"bun": "adapters/bun"}
  files: Array<{
    path: string               // "<name>/<rel>" (or any relative path for hand-authored)
    contents: string           // verbatim, with imports normalized to "@hyper/*"
    sha256: string             // SHA-256 of `contents`
    target?: string            // optional override: "@base/<rel>", "@root/<rel>", "@cursor/<rel>", "~/<rel>"
  }>
  envVars?:           Record<string, string>  // appended to .env.local on install
  docs?:              string                  // markdown printed after install
}
```

Index shape:

```ts
interface RegistryIndex {
  $schema?: string             // "https://hyperjs.ai/schema/registry.json"
  schema: 1
  generatedAt: string          // ISO-8601
  source: string               // upstream repo URL
  components: Array<{
    name: string
    version: string
    title?: string
    description: string
    registryDeps: string[]
    fileCount: number
  }>
}
```

JSON Schemas for IDE validation:

```
<registryUrl>/schema/registry-item.json   # component manifest schema
<registryUrl>/schema/registry.json        # index schema
<registryUrl>/schema/hyper-config.json    # hyper.config.json (also at /schema.json)
```

Every served manifest carries a `$schema` URL pointing at the appropriate
schema, so editors validate the JSON automatically.

### Per-file `target`

Each `files[]` entry can declare exactly where it lands in the user's
project. Useful for editor rules (`.cursor/rules/*.md`), root-level
configs (`AGENTS.md`), or anything that doesn't belong under `baseDir`.

| placeholder    | expands to                  | example use                                  |
| -------------- | --------------------------- | -------------------------------------------- |
| `@base/<rel>`  | `<baseDir>/<rel>`           | non-default location for source files        |
| `@root/<rel>`  | `<rel>`                     | `AGENTS.md`, `.gitignore`                    |
| `@cursor/<rel>`| `.cursor/<rel>`             | `.cursor/rules/hyper.md`                     |
| `~/<rel>`      | `<rel>` (alias of `@root`)  | shorthand                                    |

If `target` is omitted, paths starting with `<componentName>/` go under
`<baseDir>/`; everything else is a project-root drop. Files with
`.ts`/`.tsx`/`.js`/`.mjs` extensions go through alias rewriting; markdown,
JSON, env files, and other non-source extensions are written verbatim.

### `envVars`

Components can declare runtime env vars. The CLI appends them to
`.env.local` on install (existing keys are preserved verbatim, so re-runs
are idempotent). Two interpolations are resolved locally — secrets never
leave the user's machine:

| pattern                   | replacement                                |
| ------------------------- | ------------------------------------------ |
| `${random:hex:32}`        | 32 random bytes as a 64-char hex string    |
| `${random:base64:24}`     | 24 random bytes as a base64 string         |

Anything else is written through verbatim.

### `docs`

Short markdown printed by `hyper add` after a successful install — setup
notes, security caveats, links to the README. Re-runs don't re-print
docs for components that were already up-to-date.

### Authoring fields in `package.json`

Package-derived components can carry the new fields under a top-level
`hyper` key, keeping npm tooling unaware:

```json
{
  "name": "@hyper/auth-jwt",
  "version": "0.2.0",
  "hyper": {
    "title": "JWT auth",
    "envVars": { "JWT_SECRET": "${random:hex:32}" },
    "docs": "Mount with `app.use(authJwtPlugin())`. Verifies HS256 by default."
  }
}
```

### Hand-authored components

For non-package components (such as `agent-rules`), use a `manifest.json`
that mirrors `RegistryComponent` plus per-file overrides:

```json
{
  "name": "agent-rules",
  "version": "0.1.0",
  "title": "Agent rules",
  "description": "…",
  "files": [
    { "path": "AGENTS.md",              "target": "@root/AGENTS.md" },
    { "path": ".cursor/rules/hyper.md", "target": "@root/.cursor/rules/hyper.md" }
  ],
  "docs": "Files installed: AGENTS.md, .cursor/rules/hyper.md"
}
```

## MCP endpoint

`<registryUrl>/mcp` exposes a JSON-RPC 2.0 endpoint with five tools:

| tool                 | inputs            | returns                                  |
| -------------------- | ----------------- | ---------------------------------------- |
| `listComponents`     | —                 | full catalog                             |
| `searchComponent`    | `{q}`             | matching index entries                   |
| `getComponent`       | `{name}`          | full manifest (files + readme + deps)    |
| `previewComponent`   | `{name}`          | manifest minus file contents (lightweight) |
| `getReadme`          | `{name}`          | just the README markdown                 |

Wire it into Cursor / Claude Desktop:

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "hyper": { "url": "https://hyperjs.ai/mcp" }
  }
}
```

Now any AI agent can browse + install Hyper components conversationally
("install the rate-limiting plugin and a session middleware backed by
SQLite").

## Self-hosting

The wire format is dependency-free JSON. To host your own registry:

1. Fork `apps/registry/` (it's a Hyper app — dogfoods the framework).
2. Deploy to any Bun-capable function host. The included `vercel.json` is a
   working reference. The function reads its data from a generated TypeScript
   module (`apps/registry/src/generated/registry-data.ts`) that the
   `vercel-build` hook regenerates on every deploy. No JSON is committed,
   nothing is served from disk at request time.
3. Configure `HYPER_REGISTRY_URL=https://your-domain` (or set
   `registryUrl` in `hyper.config.json`).

The CLI ships with a bundled offline snapshot
(`packages/cli/src/registry/snapshot.ts`, also generated, also gitignored)
as a fallback — `hyper add` keeps working when the registry is unreachable.
Self-hosters can regenerate that snapshot from their own fork by running
`bun run build:snapshots` against the upstream sources they want to bake in.

## Trade-offs

- **No version ranges yet.** Each install pins a specific version in
  the lockfile. `hyper update` is the only path to a newer version. We
  may add `^` / `~` range pinning later if there's demand.
- **No tests in components.** `__tests__/` directories aren't copied.
  We may add `--with-tests` if there's interest.
- **No JSX-aware components.** Hyper is server-side; there's no
  story for installing React-ish UI components alongside framework
  source.
