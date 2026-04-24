# @usehyper/openapi

OpenAPI 3.1 serializer + Swagger UI for Hyper. Pluggable SchemaConverter.

## Install

```bash
bun add @usehyper/openapi
```

## Usage

```ts
import { openapiPlugin } from "@usehyper/openapi"
import { zodConverter } from "@usehyper/openapi-zod"
app({ plugins: [openapiPlugin({ converter: zodConverter })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
