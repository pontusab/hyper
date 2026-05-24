# @hyper/cors

Minimal, strict CORS middleware for Hyper.

## Install

```bash
bun add @hyper/cors
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { corsPlugin } from "@hyper/cors"

export default new Hyper()
  .use(corsPlugin({ origin: ["https://example.com"] }))
  .get("/", () => ({ hello: "world" }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
