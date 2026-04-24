# @usehyper/idempotency

Idempotency-Key middleware — one-shot result caching for mutating requests.

## Install

```bash
bun add @usehyper/idempotency
```

## Usage

```ts
import { idempotency } from "@usehyper/idempotency"
app({ use: [idempotency()] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
