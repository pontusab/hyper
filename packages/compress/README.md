# @hyper/compress

Content-negotiated gzip/brotli compression plugin for Hyper.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add compress
```

Wires the alias `@hyper/compress` to `src/hyper/compress/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { compress } from "@hyper/compress"

export default new Hyper()
  .use(compress())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
