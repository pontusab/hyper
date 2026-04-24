# @usehyper/msgpack

MessagePack wire format for Hyper — content-negotiated encode/decode.

## Install

```bash
bun add @usehyper/msgpack
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { msgpack } from "@usehyper/msgpack"

export default new Hyper()
  .use(msgpack())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
