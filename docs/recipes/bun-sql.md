# Recipe: bun:sql

Bun's native SQL driver is the fastest Node-compatible client to
Postgres/MySQL. Combine it with `@usehyper/log/wrap-queries` for zero-dep
structured DB observability.

```ts
import { SQL } from "bun"
import { log } from "@usehyper/log"
import { wrapQueries } from "@usehyper/log/wrap-queries"

const sqlRaw = new SQL(process.env.DATABASE_URL!)
export const sql = wrapQueries(sqlRaw, {
  logger: log.child({ component: "db" }),
  name: "bun:sql",
})
```

Decorate the app:

```ts
import { Hyper, notFound, ok } from "@usehyper/core"
import { sql } from "./sql.ts"

export default new Hyper()
  .decorate(() => ({ sql }))
  .get("/users/:id", async ({ ctx, params }) => {
    const rows = await ctx.sql`SELECT id, email FROM users WHERE id = ${params.id}`
    return rows.length === 0 ? notFound({ code: "not_found" }) : ok(rows[0])
  })
  .listen(3000)
```

## Connection lifecycle

```ts
new Hyper().decorate(() => ({
  sql,
  [Symbol.asyncDispose]: () => sql.close(),
}))
```

`Symbol.asyncDispose` is awaited when the app stops (SIGTERM, test
teardown, or explicit `app.close()`).
