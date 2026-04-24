# @hyper/session

Signed-cookie session middleware for Hyper. Pluggable stores.

## Install

```bash
bun add @hyper/session
```

## Usage

```ts
import { session, csrfGuard } from "@hyper/session"
app({ use: [session({ secret: env.SESSION_SECRET }), csrfGuard()] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
