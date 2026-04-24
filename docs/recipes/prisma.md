# Recipe: Prisma

```ts
import { PrismaClient } from "@prisma/client"
import { wrapQueries } from "@hyper/log/wrap-queries"
import { log } from "@hyper/log"

const prismaRaw = new PrismaClient()
export const prisma = wrapQueries(prismaRaw, {
  logger: log.child({ component: "db" }),
  name: "prisma",
})
```

Wire it into `decorate`:

```ts
import { app } from "@hyper/core"
import { prisma } from "./prisma.ts"

export const api = app({
  decorate: [() => ({ prisma })],
})
```

Prisma's own `log: ["query"]` option works alongside `wrapQueries` — you
get both the per-call structured event *and* Prisma's native query log.

## Graceful shutdown

Prisma holds connections. Hyper's `Symbol.asyncDispose` pattern makes
shutdown tidy:

```ts
import { app } from "@hyper/core"
export const api = app({
  decorate: [() => ({
    prisma,
    [Symbol.asyncDispose]: () => prisma.$disconnect(),
  })],
})
```
