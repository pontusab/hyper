# Hyper

Fast, opinionated, AI-native API framework for Bun. Distributed via a
component registry, not npm: the framework source lives in your repo,
owned and editable.

```bash
bun create hyper my-app
cd my-app
bun install
bun run dev
```

## Why

- **Source you own.** Components install via `hyper add` into `src/hyper/<name>/` — vendored into your repo, no `@usehyper/*` runtime deps, fully editable. `hyper diff` / `hyper update` keep you in sync with the upstream registry whenever you want.
- **Bun-first, zero-alloc hot paths.** Hand-rolled router, lazy body parsing, `Bun.CookieMap`, `Bun.password`, `Bun.hash.xxHash3`. `staticResponse()` shortcuts mount as native `Bun.serve` routes and bypass the handler entirely.
- **Secure by default.** HSTS (prod-only), method-override rejection, 1MB body cap, prototype-pollution guards, per-route timeouts, 32-byte secret floor on JWT/session, strict CORS wildcard rejection, CSRF double-submit, auth endpoint rate-limiting.
- **AI-native.** Every route projects to OpenAPI 3.1, a typed RPC client, and an MCP manifest from the same definition. `hyper mcp` serves your app to any MCP-aware agent.
- **One-setup DX.** `new Hyper().<method>(path, opts?, handler)` is the whole story — verb shortcuts for simple routes, the full `route.<method>(path).body(Schema).handle(...)` builder when you want it, plus a single polymorphic `.use()` to compose sub-apps, plugins, middleware, and ESM namespaces. Typed ctx, typed errors (`.throws({...})` / `.errors({...})`), fluent middleware.
- **Testable in milliseconds.** `@hyper/testing` ships `app.test()`, memory stores, deterministic time, event capture, fuzz corpus, type-level helpers. All 218 framework tests run in ~170ms.

## Quick example

```ts
import { Hyper, ok } from "@hyper/core"
import { z } from "zod"

export default new Hyper()
  .get("/health", "OK")
  .post(
    "/users",
    { body: z.object({ name: z.string(), email: z.email() }) },
    ({ body }) => ok({ id: crypto.randomUUID(), ...body }),
  )
  .listen(3000)
```

`new Hyper()` is the entrypoint; `.listen()` wires `Bun.serve`, graceful
shutdown, and a dev banner. During CLI introspection (`hyper dev`,
`hyper openapi`, `hyper bench`, `hyper routes`) the socket is skipped
via `HYPER_SKIP_LISTEN` so this single file is also the manifest.

### Multi-file

Each sub-app carries its own prefix; compose with `.use()`:

```ts
// src/routes/users.ts
import { Hyper, ok } from "@hyper/core"
import { z } from "zod"

export default new Hyper({ prefix: "/users" })
  .get("/", () => ok([{ id: 1 }]))
  .get("/:id", ({ params }) => ok({ id: params.id }))
  .post(
    "/",
    { body: z.object({ name: z.string() }) },
    ({ body }) => ok({ id: crypto.randomUUID(), ...body }),
  )
```

```ts
// src/app.ts
import { Hyper } from "@hyper/core"
import users from "./routes/users.ts"
import posts from "./routes/posts.ts"

export default new Hyper()
  .use(users)           // honors the sub-app's own prefix → /users/*
  .use("/v1", posts)    // re-prefixed → /v1/posts/*
  .listen(3000)
```

The same `.use()` also accepts raw routes, plugins, middleware, a
`GroupBuilder`, or an ESM namespace (`import * as users from "./routes/users"`).

## Components & the registry

Hyper ships as a registry, not as `npm install @usehyper/*`. The CLI
fetches components from [hyperjs.ai](https://hyperjs.ai) and copies
their source into your repo:

```bash
hyper init my-app --template api      # scaffolds + installs core + log
hyper add cors auth-jwt session       # transitive registry deps resolved
hyper add agent-rules                 # AI-agent guidance (.cursor/rules + AGENTS.md)
hyper diff log                        # inspect drift between local + registry
hyper update                          # bump installed components
hyper list                            # browse the catalog
hyper add --info openapi              # readme + files + deps without installing
```

Files land at `src/hyper/<component>/` and resolve via the `@hyper/*`
tsconfig path. `hyper.lock.json` pins per-file hashes so `diff`/`update`
are deterministic. AI assistants discover the registry through the MCP
endpoint at [`https://hyperjs.ai/mcp`](https://hyperjs.ai/mcp).

See [docs/registry.md](docs/registry.md) for the manifest schema +
self-hosting guide.

## The CLI

```
hyper init [template]       scaffold a new app + auto-install core
hyper dev [entry]           bun --hot + tsgo --watch (--test runs bun test --watch too)
hyper build [entry]         bundle + route graph + static-response hints
hyper test                  .example() contracts + bun:test (--fuzz --types --reporter=junit)
hyper bench [entry]         in-process latency benchmark (--tests across every route)
hyper security --check      static audit of your secure-by-default posture
hyper env --check           validate env against declared schemas (--unsafe-print to dump)
hyper openapi [out]         OpenAPI 3.1 spec
hyper client <out>          typed RPC client (--result-types for Result<T,E> unions)
hyper mcp [entry]           serve MCP (--audit to print exposed surface)
hyper routes [entry]        print the route graph

# Registry commands
hyper add <component>...    install components (--force --dry-run --info --list --json)
hyper diff <component>      show drift between installed files + registry
hyper update [component...] bump installed components to latest registry version
hyper list [query]          browse / search the registry catalog
hyper search <query>        alias of `hyper list <query>`
```

## Further reading

- [Getting started](docs/getting-started.md)
- [Registry & CLI](docs/registry.md)
- [Testing](docs/testing.md)
- [Secure-by-default baseline](docs/security/defaults.md)
- Recipes: [Drizzle](docs/recipes/drizzle.md) - [Prisma](docs/recipes/prisma.md) - [bun:sql](docs/recipes/bun-sql.md) - [tRPC bridge](docs/recipes/trpc-bridge.md) - [Session auth](docs/recipes/session-auth.md) - [JWT auth](docs/recipes/jwt-auth.md) - [Observability](docs/recipes/observability.md)
- [Changelog](CHANGELOG.md)

## Status

0.1.0 early preview. Public API may still change. 218 passing tests, security posture audited via `hyper security --check`, performance gates measured via `hyper bench --tests`.

MIT licensed.
