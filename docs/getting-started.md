# Getting started

This walks you from zero to a running Hyper app with one route, one test, and
a baseline bench run.

## Requirements

- Bun 1.3.0 or newer. Install from [bun.sh](https://bun.sh).
- (Optional) `tsgo` for fast incremental type-checking; falls back to `tsc`.

## Scaffold a new app

```bash
bun create hyper my-app
cd my-app
bun install
bun run dev
```

`bun run dev` invokes `hyper dev`, which runs the entry file under
`bun --hot` and `tsgo --watch` side-by-side. Curl the default route:

```bash
curl http://localhost:3000/
```

## Your first route

Open `src/app.ts`:

```ts
import { Hyper, ok } from "@hyper/core"
import { z } from "zod"

export default new Hyper()
  .post(
    "/users",
    { body: z.object({ name: z.string() }) },
    ({ body }) => ok({ id: crypto.randomUUID(), name: body.name }),
  )
  .listen(Number(process.env.PORT ?? 3000))
```

Save the file. `bun --hot` reloads in place via `server.reload`, so open
connections stay up. During `hyper dev`, `hyper openapi`, `hyper bench`,
or `hyper routes` the `HYPER_SKIP_LISTEN` environment flag prevents the
socket from being bound — the CLI still introspects the chain via
`.build()`.

## Multi-file apps

Hyper sub-apps compose through a single polymorphic `.use()`:

```ts
// src/routes/users.ts
import { Hyper, ok } from "@hyper/core"
export default new Hyper({ prefix: "/users" })
  .get("/", () => ok([{ id: 1 }]))
  .get("/:id", ({ params }) => ok({ id: (params as { id: string }).id }))
```

```ts
// src/app.ts
import { Hyper } from "@hyper/core"
import users from "./routes/users.ts"

export default new Hyper()
  .use(users)           // routes land at /users/*
  // .use("/v1", users) // re-prefix → /v1/users/*
  .listen(3000)
```

The same `.use()` accepts plugins, middleware, raw `Route` values,
arrays of routes, `GroupBuilder`s, and ESM namespace objects
(`import * as users from "./routes/users"`).

## Your first test

Create `src/__tests__/users.test.ts`:

```ts
import { expect, test } from "bun:test"
import { assertResponse, call } from "@hyper/testing"
import api from "../app.ts"

test("POST /users returns an id", async () => {
  const res = await call(api, "POST", "/users", { body: { name: "Ada" } })
  assertResponse(res).isOk().jsonMatches({ name: "Ada" })
})
```

Run it:

```bash
bun test
```

## Benchmark it

```bash
hyper bench --path /users --method POST --n 5000
```

Or sweep every route in one go:

```bash
hyper bench --tests --p50 250 --p95 800
```

Use `--p50`/`--p95` as CI gates. Exits non-zero on miss.

## Audit your security posture

```bash
hyper security --check
```

Checks default headers, timeout budgets, JWT/session secret lengths, CORS
wildcards, auth rate-limiting, and CSRF coverage on cookie-authenticated
mutating routes. `--json` for machine-readable output.

## Emit a typed client

```bash
hyper client ./client-out
```

This writes `client.ts` (runtime) + `client.d.ts` (types) based on your
registered routes. Opt into tagged-union error handling with
`--result-types`:

```bash
hyper client ./client-out --result-types
```

## Next steps

- [Testing guide](testing.md)
- [Secure-by-default reference](security/defaults.md)
- [Recipes](recipes/) for ORMs, tRPC, sessions, JWT, and OTel.
