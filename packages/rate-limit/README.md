# @usehyper/rate-limit

Token-bucket rate limiting for Hyper. In-memory + pluggable stores.

## Install

```bash
bun add @usehyper/rate-limit
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { authRateLimitPlugin, rateLimit } from "@usehyper/rate-limit"

export default new Hyper()
  .use(rateLimit({ max: 100, windowMs: 60_000 }))
  .use(authRateLimitPlugin())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
