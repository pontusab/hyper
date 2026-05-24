# @hyper/msgpack

MessagePack wire format for Hyper — content-negotiated encode/decode.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add msgpack
```

Wires the alias `@hyper/msgpack` to `src/hyper/msgpack/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { msgpack } from "@hyper/msgpack"

export default new Hyper()
  .use(msgpack())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
