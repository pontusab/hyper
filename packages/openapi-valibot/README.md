# @usehyper/openapi-valibot

Valibot `SchemaConverter` for `@usehyper/openapi`.

## Install

```bash
bun add @usehyper/openapi @usehyper/openapi-valibot valibot
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { openapiPlugin } from "@usehyper/openapi"
import { valibotConverter } from "@usehyper/openapi-valibot"

export default new Hyper()
  .use(openapiPlugin({ converter: valibotConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
