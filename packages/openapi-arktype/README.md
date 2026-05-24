# @hyper/openapi-arktype

ArkType `SchemaConverter` for `@hyper/openapi`.

## Install

```bash
bun add @hyper/openapi @hyper/openapi-arktype arktype
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { openapiPlugin } from "@hyper/openapi"
import { arktypeConverter } from "@hyper/openapi-arktype"

export default new Hyper()
  .use(openapiPlugin({ converter: arktypeConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
