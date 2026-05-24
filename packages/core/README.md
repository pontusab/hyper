# @hyper/core

Hyper core — the only hard dependency across the Hyper ecosystem. Zero runtime
dependencies. Bun-native.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add core
```

Wires the alias `@hyper/core` to `src/hyper/core/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper, ok } from "@hyper/core"

export default new Hyper()
  .get("/", () => ok({ hello: "world" }))
  .listen(3000)
```

Compose sub-apps, plugins, middleware, or raw `Route` values through a single
polymorphic `.use()`:

```ts
import { Hyper } from "@hyper/core"
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
