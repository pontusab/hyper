# @hyper/cache

SWR + ETag + stampede protection for Hyper routes.

## Install

```bash
bun add @hyper/cache
```

## Usage

```ts
import { cache } from "@hyper/cache"
route.get("/feed").use(cache({ maxAgeMs: 60_000 })).handle(...)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
