# @hyper/session

Signed-cookie session middleware for Hyper. Pluggable stores.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add session
```

Wires the alias `@hyper/session` to `src/hyper/session/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { csrfGuard, session } from "@hyper/session"

export default new Hyper()
  .use(session({ secret: process.env.SESSION_SECRET! }))
  .use(csrfGuard())
  .get("/me", ({ ctx }) => ({ session: ctx.session }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
