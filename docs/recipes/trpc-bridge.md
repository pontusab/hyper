# Recipe: tRPC bridge

`@hyper/trpc` gives you a two-way bridge: call Hyper routes from tRPC
clients, or mount a tRPC router under Hyper.

## Expose Hyper routes as a tRPC router

```ts
import { toTrpcRouter } from "@hyper/trpc"
import { initTRPC } from "@trpc/server"
import { api } from "./app.ts"

const t = initTRPC.create()
export const appRouter = toTrpcRouter(api, { t })
export type AppRouter = typeof appRouter
```

Any route with `meta.name = "users.list"` becomes a tRPC procedure named
`users.list`. Inputs/outputs are re-projected from the same Standard
Schema definitions — no duplication.

## Mount an existing tRPC router under Hyper

```ts
import { fromTrpcRouter } from "@hyper/trpc"
import { userRouter } from "./user-router.ts"

const api = app({
  routes: [...fromTrpcRouter(userRouter, { prefix: "/trpc" })],
})
```

Now `POST /trpc/users.list` handles the tRPC wire format while every
other route stays on Hyper's fluent builder.

## Migration path

Typical migration from a big tRPC app:
1. Mount the whole router with `fromTrpcRouter` so today's clients keep
   working.
2. Peel off procedures one at a time, converting to
   `route.<method>(path).meta({ name: "..." })` — Hyper's typed client
   still sees them.
3. Flip callers to the new REST/RPC endpoints at your own pace.
