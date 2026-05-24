# @hyper/auth-jwt

JWT auth plugin for Hyper — bearer-token verification, typed `ctx.user`, role/scope guards.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add auth-jwt
```

Wires the alias `@hyper/auth-jwt` to `src/hyper/auth-jwt/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper, ok } from "@hyper/core"
import { authJwtPlugin } from "@hyper/auth-jwt"

export default new Hyper()
  .use(authJwtPlugin({ secretEnv: "JWT_SECRET" }))
  .get("/me", ({ ctx }) => ok({ user: ctx.user }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
