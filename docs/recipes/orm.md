# ORM recipes

Hyper does not ship dedicated ORM packages. Each ORM already has a first-class
install path; Hyper just decorates `ctx` with an instrumented handle.

## Drizzle

```ts
import Database from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Hyper } from "@usehyper/core"
import { wrapDrizzle } from "@usehyper/log/drizzle"

declare module "@usehyper/core" {
  interface AppContext {
    db: ReturnType<typeof drizzle>
  }
}

const sqlite = new Database("app.db")
const base = drizzle(sqlite)

export default new Hyper()
  .decorate(() => ({ db: wrapDrizzle(base) }))
  .listen(3000)
```

Detailed guide: see [drizzle.md](./drizzle.md).

## Prisma

```ts
import { PrismaClient } from "@prisma/client"
import { prismaLogExtension } from "@usehyper/log/prisma"

const prisma = new PrismaClient().$extends(prismaLogExtension())
```

Detailed guide: see [prisma.md](./prisma.md).

## Bun.sql

```ts
import { sql as raw } from "bun"
import { wrapBunSql } from "@usehyper/log/bun-sql"

export const sql = wrapBunSql(raw)
```

Detailed guide: see [bun-sql.md](./bun-sql.md).

## Generic repository

```ts
import { wrapQueries } from "@usehyper/log"

const repo = wrapQueries({ findUser, createUser /* … */ }, { name: "repo" })
```
