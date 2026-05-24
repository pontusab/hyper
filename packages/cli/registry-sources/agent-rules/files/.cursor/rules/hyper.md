---
description: How to write Hyper routes, plugins, and middleware in this repo
globs:
  - src/hyper/**/*.ts
  - src/**/*.ts
alwaysApply: true
---

# Hyper rules

This project uses [Hyper](https://hyperjs.ai), a Bun-first API framework whose
source code lives in this repository at `src/hyper/<component>/`. Imports use
the `@hyper/*` alias (mapped via `tsconfig.json` `paths`).

## Authoring routes

Two equivalent styles. Prefer the chain API for app composition; prefer the
builder for routes you want to attach middleware/decorators/types to.

### Chain API (preferred for top-level apps)

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

### Route builder (preferred when you need typed responses + middleware)

```ts
import { ok, route, notFound } from "@hyper/core"
import { z } from "zod"

const UserParams = z.object({ id: z.string() })

export const getUser = route
  .get("/users/:id")
  .params(UserParams)
  .handle(async ({ params, ctx }) => {
    const u = await ctx.store.get(params.id)
    if (!u) return notFound({ code: "user_not_found" })
    return ok(u)
  })
```

## Composing apps with `.use()`

`.use()` is polymorphic. It accepts:

- A sub-`Hyper` instance — its prefix is honored
- A `HyperApp` from `app({...})`
- A raw `Route` value or array of routes
- A plugin returned by a plugin factory (`hyperLog(...)`, `cors(...)`, etc.)
- A plain middleware (object with `start`/`success`/`error`/`finish`)

```ts
import { Hyper } from "@hyper/core"
import { hyperLog } from "@hyper/log"
import { cors } from "@hyper/cors"
import users from "./routes/users.ts"
import posts from "./routes/posts.ts"

export default new Hyper()
  .use(hyperLog({ service: "api" }))
  .use(cors({ origin: ["https://example.com"] }))
  .use(users)            // honors `users`'s own prefix
  .use("/v1", posts)     // re-prefix
  .listen(3000)
```

## Decorating context

Use `.decorate()` (or `decorate: [...]` in `app({...})`) to attach typed
services to `ctx`. Always extend `AppContext` via module augmentation so
handlers see the right types.

```ts
import { Hyper } from "@hyper/core"
import { db } from "./db.ts"

declare module "@hyper/core" {
  interface AppContext {
    readonly db: typeof db
  }
}

export default new Hyper().decorate(() => ({ db }))
```

## Response helpers

Always return through helpers — they project to OpenAPI/MCP/client-types
correctly. Never `new Response()` directly.

```ts
import {
  ok, created, accepted, noContent,
  badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooManyRequests,
  redirect, html, text, sse, stream, file,
} from "@hyper/core"
```

## Errors

Throw `HyperError` for typed errors — they project to the route's `errors`
union and serialize consistently.

```ts
import { createError } from "@hyper/core"

throw createError({ status: 409, code: "duplicate_email", message: "Email already in use" })
```

## Validation

Body / params / query schemas are Standard Schema-compatible: Zod, Valibot,
ArkType all work. Schemas declared on a route project to OpenAPI input
schemas automatically.

## Secure-by-default — do NOT disable lightly

Hyper sets these for every response unless explicitly turned off:

- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: strict-origin-when-cross-origin`
- `strict-transport-security` (production only)
- 1MB body cap
- prototype-pollution guards on JSON bodies
- per-route timeouts

Auth endpoints default to rate-limiting via `@hyper/rate-limit`. JWT secrets
must be ≥32 bytes (`@hyper/auth-jwt` will refuse to start otherwise).

## Testing

Use `@hyper/testing` — `app.test()`, `call()`, memory stores, deterministic
clocks. Tests should run against `app.fetch(new Request(...))` directly,
no network.

```ts
import { describe, expect, test } from "bun:test"
import app from "../src/app.ts"

describe("users", () => {
  test("GET /users/:id", async () => {
    const res = await app.fetch(new Request("http://localhost/users/u1"))
    expect(res.status).toBe(200)
  })
})
```

## File layout convention

```
src/
  hyper/                 # Hyper framework source (managed by `hyper` CLI)
    core/                # @hyper/core
    log/                 # @hyper/log
    cors/                # @hyper/cors
    ...
  app.ts                 # entrypoint; default-exports a Hyper instance or HyperApp
  routes/                # sub-app modules (preferred over inline routes)
  schemas/               # Zod / Valibot schemas
```

`src/hyper/` is owned by the registry — do not edit by hand unless you intend
to fork that component (and accept that `hyper update` will conflict). Run
`hyper diff` to inspect drift between your local copy and the upstream
registry.
