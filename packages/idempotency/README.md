# @hyper/idempotency

`Idempotency-Key` middleware — one-shot result caching for mutating requests.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add idempotency
```

Wires the alias `@hyper/idempotency` to `src/hyper/idempotency/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { idempotency } from "@hyper/idempotency"

export default new Hyper()
  .use(idempotency())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
