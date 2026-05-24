# @hyper/compress

Content-negotiated gzip/brotli compression plugin for Hyper.

## Install

```bash
bun add @hyper/compress
```

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
