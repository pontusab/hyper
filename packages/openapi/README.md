# @usehyper/openapi

OpenAPI 3.1 serializer + Swagger UI for Hyper. Pluggable `SchemaConverter`.

## Install

```bash
bun add @usehyper/openapi @usehyper/openapi-zod
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
