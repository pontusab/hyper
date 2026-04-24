# @hyper/rate-limit

Token-bucket rate limiting for Hyper. In-memory + pluggable stores.

## Install

```bash
bun add @hyper/rate-limit
```

## Usage

```ts
import { rateLimit, authRateLimitPlugin } from "@hyper/rate-limit"
app({ use: [rateLimit({ max: 100, windowMs: 60_000 })], plugins: [authRateLimitPlugin()] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
