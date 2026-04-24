# Recipe: Drizzle ORM

Hyper stays out of your data layer. Use Drizzle directly and wire it to
`@usehyper/log` so every query shows up in structured events with timing.

## Setup

```ts
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { wrapQueries } from "@usehyper/log/wrap-queries"
import { log } from "@usehyper/log"

const raw = drizzle(new Database(process.env.DB_URL ?? "app.db"))
export const db = wrapQueries(raw, {
  logger: log.child({ component: "db" }),
  name: "drizzle",
})
```

`wrapQueries` instruments every async method with structured begin/end
events. Slow queries cross the default `slowMs: 200` threshold and emit
a `db.query.slow` event with the full SQL and bound parameters.

## Context decoration

Expose the wrapped client on every request:

```ts
import { app } from "@usehyper/core"
import { db } from "./db.ts"

export const api = app({
  decorate: [() => ({ db })],
  routes: [/* ... */],
})
```

Handlers read it via `ctx.db`:

```ts
route.get("/users/:id").handle(async ({ params, ctx }) => {
  const user = await ctx.db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, params.id),
  })
  return user ? ok(user) : notFound()
})
```

## Migrations

Keep migrations outside the request path. Drizzle's `drizzle-kit` CLI
owns schema; Hyper never touches it.

## Testing

Swap in an in-memory SQLite for isolated tests:

```ts
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"

const testDb = drizzle(new Database(":memory:"))
const scoped = api.test({ decorate: () => ({ db: testDb }) })
```
