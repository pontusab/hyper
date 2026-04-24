# @usehyper/core

Hyper core — the only hard dependency across the Hyper ecosystem. Zero runtime
dependencies. Bun-native.

## Install

```bash
bun add @usehyper/core
```

## Usage

```ts
import { Hyper, ok } from "@usehyper/core"

export default new Hyper()
  .get("/", () => ok({ hello: "world" }))
  .listen(3000)
```

Compose sub-apps, plugins, middleware, or raw `Route` values through a single
polymorphic `.use()`:

```ts
import { Hyper } from "@usehyper/core"
import users from "./routes/users.ts"

export default new Hyper()
  .use(users)           // honors sub-app's own prefix
  .use("/v1", users)    // or re-prefix explicitly
  .listen(3000)
```

CLI tools (`hyper openapi`, `hyper routes`, `hyper bench`, `hyper dev`) set
`HYPER_SKIP_LISTEN=1` before importing, so the same file serves as both
server entrypoint and introspection manifest.

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides,
security defaults, and integration recipes.

## License

MIT
