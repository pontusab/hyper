# Hyper

Fast, opinionated, AI-native API framework for Bun.

```bash
bun create hyper my-app
cd my-app
bun run dev
```

## Why

- **Bun-first, zero-alloc hot paths.** Hand-rolled router, lazy body parsing, `Bun.CookieMap`, `Bun.password`, `Bun.hash.xxHash3`. `staticResponse()` shortcuts mount as native `Bun.serve` routes and bypass the handler entirely.
- **Secure by default.** HSTS (prod-only), method-override rejection, 1MB body cap, prototype-pollution guards, per-route timeouts, 32-byte secret floor on JWT/session, strict CORS wildcard rejection, CSRF double-submit, auth endpoint rate-limiting.
- **AI-native.** Every route projects to OpenAPI 3.1, a typed RPC client, and an MCP manifest from the same definition. `hyper mcp` serves your app to any MCP-aware agent.
- **One-setup DX.** `app({ routes })` + `route.<method>(path).body(Schema).handle(...)` is the whole story. Typed ctx, typed errors (`.throws({...})` / `.errors({...})`), fluent middleware.
- **Testable in milliseconds.** `@hyper/testing` ships `app.test()`, memory stores, deterministic time, event capture, fuzz corpus, type-level helpers. All 191 framework tests run in ~150ms.

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
  .get("/:id", ({ params }) => ok({ id: (params as { id: string }).id }))
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

## The CLI

```
hyper init [template]       scaffold a new app
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
hyper add <component>       Shadcn-style installable components
hyper diff <component>      show drift between installed + registry
```

## Further reading

- [Getting started](docs/getting-started.md)
- [Testing](docs/testing.md)
- [Secure-by-default baseline](docs/security/defaults.md)
- Recipes: [Drizzle](docs/recipes/drizzle.md) - [Prisma](docs/recipes/prisma.md) - [bun:sql](docs/recipes/bun-sql.md) - [tRPC bridge](docs/recipes/trpc-bridge.md) - [Session auth](docs/recipes/session-auth.md) - [JWT auth](docs/recipes/jwt-auth.md) - [Observability](docs/recipes/observability.md)
- [Changelog](CHANGELOG.md)

## Status

0.1.0 early preview. Public API may still change. 191 passing tests, security posture audited via `hyper security --check`, performance gates measured via `hyper bench --tests`.

MIT licensed.
