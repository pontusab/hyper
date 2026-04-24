# @hyper/idempotency

Idempotency-Key middleware — one-shot result caching for mutating requests.

## Install

```bash
bun add @hyper/idempotency
```

## Usage

```ts
import { idempotency } from "@hyper/idempotency"
app({ use: [idempotency()] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
