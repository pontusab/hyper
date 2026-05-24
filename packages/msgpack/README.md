# @hyper/msgpack

MessagePack wire format for Hyper — content-negotiated encode/decode.

## Install

```bash
bun add @hyper/msgpack
```

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
