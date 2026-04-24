# @usehyper/trpc

tRPC bridge — mount tRPC into Hyper, or convert a tRPC router to Hyper routes.

## Install

```bash
bun add @usehyper/trpc
```

## Usage

```ts
import { toTrpcRouter } from "@usehyper/trpc"
export const trpcRouter = toTrpcRouter(api, { t })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
