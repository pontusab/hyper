# @hyper/openapi

OpenAPI 3.1 serializer + Swagger UI for Hyper. Pluggable `SchemaConverter`.

## Install

```bash
bun add @hyper/openapi @hyper/openapi-zod
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
