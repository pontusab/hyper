# @hyper/openapi

OpenAPI 3.1 serializer + Swagger UI for Hyper. Pluggable `SchemaConverter`.

## Install

Components are installed as source into your repo, not pulled from npm. Pair `openapi` with a converter for your validation library:

```bash
bunx hyper add openapi openapi-zod
# or: bunx hyper add openapi openapi-arktype
# or: bunx hyper add openapi openapi-valibot
```

See [hyperjs.ai](https://hyperjs.ai) for the full registry.

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
