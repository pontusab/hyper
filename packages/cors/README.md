# @hyper/cors

Minimal, strict CORS middleware for Hyper.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add cors
```

Wires the alias `@hyper/cors` to `src/hyper/cors/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

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
