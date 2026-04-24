# @usehyper/cache

SWR + ETag + stampede protection for Hyper routes.

## Install

```bash
bun add @usehyper/cache
```

## Usage

```ts
import { Hyper, ok } from "@usehyper/core"
import { cache } from "@usehyper/cache"

export default new Hyper()
  .use(cache({ maxAgeMs: 60_000 }))
  .get("/feed", async () => ok(await loadFeed()))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
