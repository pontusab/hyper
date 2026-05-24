# @hyper/openapi-valibot

Valibot `SchemaConverter` for `@hyper/openapi`.

## Install

```bash
bun add @hyper/openapi @hyper/openapi-valibot valibot
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
