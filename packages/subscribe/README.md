# @hyper/subscribe

route.subscribe() primitive — projects to SSE, MCP resource notifications, tRPC subscriptions.

## Install

```bash
bun add @hyper/subscribe
```

## Usage

```ts
import { subscribe } from "@hyper/subscribe"
route.get("/events").pipe(subscribe(async function* () { yield { type: "tick" } }))
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
