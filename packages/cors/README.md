# @usehyper/cors

Minimal, strict CORS middleware for Hyper.

## Install

```bash
bun add @usehyper/cors
```

## Usage

```ts
import { corsPlugin } from "@usehyper/cors"
app({ plugins: [corsPlugin({ origin: ["https://example.com"] })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
