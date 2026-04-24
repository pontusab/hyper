# @usehyper/openapi-zod

Zod (v3 + v4) `SchemaConverter` for `@usehyper/openapi`.

## Install

```bash
bun add @usehyper/openapi @usehyper/openapi-zod zod
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { openapiPlugin } from "@usehyper/openapi"
import { zodConverter } from "@usehyper/openapi-zod"

export default new Hyper()
  .use(openapiPlugin({ converter: zodConverter }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
