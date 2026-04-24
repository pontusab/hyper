# Recipe: bun:sql

Bun's native SQL driver is the fastest Node-compatible client to
Postgres/MySQL. Combine it with `@usehyper/log/wrap-queries` for zero-dep
structured DB observability.

```ts
import { SQL } from "bun"
import { wrapQueries } from "@usehyper/log/wrap-queries"
import { log } from "@usehyper/log"

const sqlRaw = new SQL(process.env.DATABASE_URL!)
export const sql = wrapQueries(sqlRaw, {
  logger: log.child({ component: "db" }),
  name: "bun:sql",
})
```

Decorate:

```ts
import { app } from "@usehyper/core"
import { sql } from "./sql.ts"

export const api = app({
  decorate: [() => ({ sql })],
})
```

Usage in a route:

```ts
route.get("/users/:id").handle(async ({ params, ctx }) => {
  const rows = await ctx.sql`SELECT id, email FROM users WHERE id = ${params.id}`
  return rows.length === 0 ? notFound() : ok(rows[0])
})
```

## Connection lifecycle

```ts
app({
  decorate: [() => ({ sql, [Symbol.asyncDispose]: () => sql.close() })],
})
```

`Symbol.asyncDispose` is awaited when the app stops (SIGTERM, test tear-
down, or explicit `app.close()`).
