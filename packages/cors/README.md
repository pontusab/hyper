# @hyper/cors

Minimal, strict CORS middleware for Hyper.

## Install

```bash
bun add @hyper/cors
```

## Usage

```ts
import { corsPlugin } from "@hyper/cors"
app({ plugins: [corsPlugin({ origin: ["https://example.com"] })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
