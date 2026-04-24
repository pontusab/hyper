# @usehyper/openapi-arktype

ArkType `SchemaConverter` for `@usehyper/openapi`.

## Install

```bash
bun add @usehyper/openapi @usehyper/openapi-arktype arktype
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { openapiPlugin } from "@usehyper/openapi"
import { arktypeConverter } from "@usehyper/openapi-arktype"

export default new Hyper()
  .use(openapiPlugin({ converter: arktypeConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
