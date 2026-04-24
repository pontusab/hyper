# ORM recipes

Hyper does not ship dedicated ORM packages. Each ORM already has a first-class
install path; Hyper just decorates `ctx` with an instrumented handle.

## Drizzle

```ts
import { drizzle } from "drizzle-orm/bun-sqlite"
import Database from "bun:sqlite"
import { wrapDrizzle } from "@hyper/log/drizzle"
import { app } from "@hyper/core"

declare module "@hyper/core" {
  interface AppContext {
    db: ReturnType<typeof drizzle>
  }
}

const sqlite = new Database("app.db")
const base = drizzle(sqlite)

export default app({
  decorate: [
    () => ({ db: wrapDrizzle(base, () => /* getLog for this request */ undefined) }),
  ],
})
```

## Prisma

```ts
import { PrismaClient } from "@prisma/client"
import { prismaLogExtension } from "@hyper/log/prisma"

const prisma = new PrismaClient().$extends(prismaLogExtension(() => ctx.log))
```

## Bun.sql

```ts
import { sql as raw } from "bun"
import { wrapBunSql } from "@hyper/log/bun-sql"

const sql = wrapBunSql(raw, () => ctx.log)
```

## Generic repository

```ts
import { wrapQueries } from "@hyper/log"

const repo = wrapQueries({ findUser, createUser, ... }, () => ctx.log)
```
