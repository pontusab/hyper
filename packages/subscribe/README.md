# @hyper/subscribe

`subscribe()` primitive — projects to SSE, MCP resource notifications, tRPC subscriptions.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add subscribe
```

Wires the alias `@hyper/subscribe` to `src/hyper/subscribe/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

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
