# @hyper/openapi-zod

Zod (v3 + v4) `SchemaConverter` for `@hyper/openapi`.

## Install

Components are installed as source into your repo, not pulled from npm. `zod` is added to your `package.json` automatically as a peer dependency.

```bash
bunx hyper add openapi openapi-zod
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
