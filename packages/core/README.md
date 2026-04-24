# @usehyper/core

Hyper core — the only hard dependency across the Hyper ecosystem. Zero runtime
dependencies. Bun-native.

## Install

```bash
bun add @usehyper/core
```

## Usage

```ts
import { app, ok, route } from "@usehyper/core"

export const api = app({
  routes: [route.get("/").handle(() => ok({ hello: "world" }))],
})

Bun.serve({ port: 3000, fetch: api.fetch })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides,
security defaults, and integration recipes.

## License

MIT
