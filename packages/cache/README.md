# @hyper/cache

SWR + ETag + stampede protection for Hyper routes.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add cache
```

Wires the alias `@hyper/cache` to `src/hyper/cache/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper, ok } from "@hyper/core"
import { cache } from "@hyper/cache"

export default new Hyper()
  .use(cache({ maxAgeMs: 60_000 }))
  .get("/feed", async () => ok(await loadFeed()))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
