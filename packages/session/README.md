# @usehyper/session

Signed-cookie session middleware for Hyper. Pluggable stores.

## Install

```bash
bun add @usehyper/session
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { csrfGuard, session } from "@usehyper/session"

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
