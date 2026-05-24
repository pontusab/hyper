# @hyper/cache

SWR + ETag + stampede protection for Hyper routes.

## Install

```bash
bun add @hyper/cache
```

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
