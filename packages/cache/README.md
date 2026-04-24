# @usehyper/cache

SWR + ETag + stampede protection for Hyper routes.

## Install

```bash
bun add @usehyper/cache
```

## Usage

```ts
import { cache } from "@usehyper/cache"
route.get("/feed").use(cache({ maxAgeMs: 60_000 })).handle(...)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
