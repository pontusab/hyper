# @hyper/auth-jwt

JWT auth middleware + .auth() route builder sugar for Hyper.

## Install

```bash
bun add @hyper/auth-jwt
```

## Usage

```ts
import { authJwtPlugin } from "@hyper/auth-jwt"
app({ plugins: [authJwtPlugin({ secretEnv: "JWT_SECRET" })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
