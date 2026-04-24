# @hyper/openapi

OpenAPI 3.1 serializer + Swagger UI for Hyper. Pluggable SchemaConverter.

## Install

```bash
bun add @hyper/openapi
```

## Usage

```ts
import { openapiPlugin } from "@hyper/openapi"
import { zodConverter } from "@hyper/openapi-zod"
app({ plugins: [openapiPlugin({ converter: zodConverter })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
