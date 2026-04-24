# Recipe: Drizzle ORM

Hyper stays out of your data layer. Use Drizzle directly and wire it to
`@usehyper/log` so every query shows up in structured events with timing.

## Setup

```ts
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { log } from "@usehyper/log"
import { wrapQueries } from "@usehyper/log/wrap-queries"

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
import { Hyper, notFound, ok } from "@usehyper/core"
import { db } from "./db.ts"

export default new Hyper()
  .decorate(() => ({ db }))
  .get("/users/:id", async ({ ctx, params }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, params.id),
    })
    return user ? ok(user) : notFound({ code: "not_found" })
  })
  .listen(3000)
```

## Migrations

Keep migrations outside the request path. Drizzle's `drizzle-kit` CLI
owns schema; Hyper never touches it.

## Testing

Swap in an in-memory SQLite for isolated tests:

```ts
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Hyper } from "@usehyper/core"

const testDb = drizzle(new Database(":memory:"))
const testApp = new Hyper().decorate(() => ({ db: testDb })) /* …routes… */
```
