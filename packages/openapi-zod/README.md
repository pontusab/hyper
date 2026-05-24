# @hyper/openapi-zod

Zod (v3 + v4) `SchemaConverter` for `@hyper/openapi`.

## Install

```bash
bun add @hyper/openapi @hyper/openapi-zod zod
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { openapiPlugin } from "@hyper/openapi"
import { zodConverter } from "@hyper/openapi-zod"

export default new Hyper()
  .use(openapiPlugin({ converter: zodConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
