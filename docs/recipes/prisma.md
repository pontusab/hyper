# Recipe: Prisma

```ts
import { PrismaClient } from "@prisma/client"
import { log } from "@hyper/log"
import { wrapQueries } from "@hyper/log/wrap-queries"

const prismaRaw = new PrismaClient()
export const prisma = wrapQueries(prismaRaw, {
  logger: log.child({ component: "db" }),
  name: "prisma",
})
```

Wire it into `.decorate()`:

```ts
import { Hyper } from "@hyper/core"
import { prisma } from "./prisma.ts"

export default new Hyper()
  .decorate(() => ({ prisma }))
  .listen(3000)
```

Prisma's own `log: ["query"]` option works alongside `wrapQueries` — you
get both the per-call structured event *and* Prisma's native query log.

## Graceful shutdown

Prisma holds connections. Hyper's `Symbol.asyncDispose` pattern makes
shutdown tidy:

```ts
import { Hyper } from "@hyper/core"

export default new Hyper().decorate(() => ({
  prisma,
  [Symbol.asyncDispose]: () => prisma.$disconnect(),
}))
```
