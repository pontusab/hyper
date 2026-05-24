# @hyper/trpc

tRPC bridge — mount tRPC into Hyper, or convert a tRPC router into Hyper routes.

## Install

```bash
bun add @hyper/trpc
```

## Usage

Mount a tRPC router inside a Hyper app:

```ts
import { Hyper } from "@hyper/core"
import { trpcPlugin } from "@hyper/trpc"
import { appRouter } from "./trpc/router.ts"

export default new Hyper()
  .use(trpcPlugin({ router: appRouter, prefix: "/trpc" }))
  .listen(3000)
```

Or convert a Hyper app into a tRPC router:

```ts
import { toTrpcRouter } from "@hyper/trpc"
import { initTRPC } from "@trpc/server"
import app from "./app.ts"

const t = initTRPC.create()
export const trpcRouter = toTrpcRouter(app, { t })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
