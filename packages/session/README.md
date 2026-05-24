# @hyper/session

Signed-cookie session middleware for Hyper. Pluggable stores.

## Install

```bash
bun add @hyper/session
```

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
