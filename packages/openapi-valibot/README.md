# @hyper/openapi-valibot

Valibot `SchemaConverter` for `@hyper/openapi`.

## Install

Components are installed as source into your repo, not pulled from npm. `valibot` is added to your `package.json` automatically as a peer dependency.

```bash
bunx hyper add openapi openapi-valibot
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { openapiPlugin } from "@hyper/openapi"
import { valibotConverter } from "@hyper/openapi-valibot"

export default new Hyper()
  .use(openapiPlugin({ converter: valibotConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
