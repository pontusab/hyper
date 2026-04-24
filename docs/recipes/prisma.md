# Recipe: Prisma

```ts
import { PrismaClient } from "@prisma/client"
import { wrapQueries } from "@usehyper/log/wrap-queries"
import { log } from "@usehyper/log"

const prismaRaw = new PrismaClient()
export const prisma = wrapQueries(prismaRaw, {
  logger: log.child({ component: "db" }),
  name: "prisma",
})
```

Wire it into `decorate`:

```ts
import { app } from "@usehyper/core"
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
import { app } from "@usehyper/core"
export const api = app({
  decorate: [() => ({
    prisma,
    [Symbol.asyncDispose]: () => prisma.$disconnect(),
  })],
})
```
