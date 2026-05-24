# @hyper/openapi-arktype

ArkType `SchemaConverter` for `@hyper/openapi`.

## Install

Components are installed as source into your repo, not pulled from npm. `arktype` is added to your `package.json` automatically as a peer dependency.

```bash
bunx hyper add openapi openapi-arktype
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
