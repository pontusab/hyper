# @usehyper/idempotency

`Idempotency-Key` middleware — one-shot result caching for mutating requests.

## Install

```bash
bun add @usehyper/idempotency
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { idempotency } from "@usehyper/idempotency"

export default new Hyper()
  .use(idempotency())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
