# @hyper/rate-limit

Token-bucket rate limiting for Hyper. In-memory + pluggable stores.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add rate-limit
```

Wires the alias `@hyper/rate-limit` to `src/hyper/rate-limit/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { authRateLimitPlugin, rateLimit } from "@hyper/rate-limit"

export default new Hyper()
  .use(rateLimit({ max: 100, windowMs: 60_000 }))
  .use(authRateLimitPlugin())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
