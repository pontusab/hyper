# @hyper/subscribe

`subscribe()` primitive — projects to SSE, MCP resource notifications, tRPC subscriptions.

## Install

```bash
bun add @hyper/subscribe
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { subscribe } from "@hyper/subscribe"

export default new Hyper()
  .use(
    subscribe("/events", async function* () {
      yield { data: { type: "tick", at: Date.now() } }
    }),
  )
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
