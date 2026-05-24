# AGENTS.md

Guidance for AI coding agents working in this repository.

This project uses [Hyper](https://hyperjs.ai), a Bun-first API framework. The
framework source is **vendored into this repo** under `src/hyper/<component>/`
and managed by the `hyper` CLI — components are installed from a registry and
copied directly into the project, not pulled in as npm dependencies. You own
the code; you can edit it freely; `hyper update` will pull upstream changes
when you ask for them.

## Quick orientation

- `src/app.ts` — entrypoint. Default-exports a `Hyper` instance or `HyperApp`.
- `src/hyper/core/` — framework runtime. Imports as `@hyper/core`.
- `src/hyper/<plugin>/` — installable plugins (log, cors, auth-jwt, …). Each is
  imported as `@hyper/<plugin>`.
- `package.json` has **no `@usehyper/*` deps** — everything ships via the
  registry.
- `hyper.config.json` — the registry config (URL, baseDir, alias).
- `hyper.lock.json` — pins each installed component's version + per-file hash.

## When you write code

1. Import from `@hyper/<component>` — never `@usehyper/<component>`.
2. Always return through Hyper's response helpers (`ok`, `created`, `notFound`, …).
3. Always declare schemas (`body`, `params`, `query`) — they project to
   OpenAPI/MCP/client types automatically.
4. Use `.decorate()` for typed services on `ctx`. Augment `AppContext` via
   `declare module "@hyper/core"`.
5. For protected routes, chain `.auth()` from `@hyper/auth-jwt`.
6. Never weaken the secure-by-default headers without an explicit reason.

## When you install components

Use the CLI, not edits:

```bash
hyper add cors
hyper add auth-jwt
hyper add openapi openapi-zod
hyper diff log              # inspect drift
hyper update log            # bump to latest registry version
hyper add --info session    # show readme/files/deps without installing
```

The CLI rewrites `@hyper/*` imports to whatever alias is configured in
`hyper.config.json`. Do not hand-edit the `paths` mapping.

## When you debug or extend

- `hyper routes` — print the route graph
- `hyper openapi` — emit OpenAPI 3.1
- `hyper client out.ts` — emit a typed RPC client
- `hyper mcp` — serve the app's routes over MCP for AI introspection
- `hyper bench --tests` — measure per-route latency

## Style

- Imports use `.ts` extensions (`from "./schemas.ts"`) — `verbatimModuleSyntax`
  is on.
- Prefer the chain API (`new Hyper().get(...)`) for top-level apps; prefer
  the builder (`route.get(...).body(...).handle(...)`) for sub-app modules.
- Tests run via `bun test` against `app.fetch(new Request(...))` — no network.
