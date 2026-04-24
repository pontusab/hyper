# Recipe: JWT auth

Use `@usehyper/auth-jwt` for bearer-token APIs. HS256 or RS256.

## Setup

```ts
import { app } from "@usehyper/core"
import { authJwt, authJwtPlugin } from "@usehyper/auth-jwt"

export const api = app({
  env: {
    schema: /* must declare JWT_SECRET of >=32 bytes, or JWT_PUBLIC_KEY */,
    secrets: ["JWT_SECRET"],
  },
  plugins: [authJwtPlugin({ secretEnv: "JWT_SECRET", alg: "HS256" })],
  routes: [
    route
      .get("/me")
      .auth() // shorthand that requires the JWT plugin
      .handle(({ ctx }) => ok({ id: ctx.user.id, roles: ctx.user.roles })),
  ],
})
```

## Route-level opt-in (no plugin)

```ts
import { authJwt } from "@usehyper/auth-jwt"

route
  .get("/private")
  .use(authJwt({ secretEnv: "JWT_SECRET" }))
  .handle(({ ctx }) => ok({ hello: ctx.user.id }))
```

## Issuing tokens in tests

`@usehyper/testing` ships `signJwtHS256`:

```ts
import { bearerAsUser, signJwtHS256 } from "@usehyper/testing"

const token = await signJwtHS256({ sub: "u1", roles: ["admin"] }, SECRET_32_BYTES)
const res = await fetch("/me", { headers: { authorization: `Bearer ${token}` } })
```

Or skip the JWT entirely and stub the user:

```ts
const test = api.test({ ctx: bearerAsUser({ id: "u1", roles: ["admin"] }) })
```

## Secret enforcement

Secrets shorter than 32 bytes are rejected at boot. Tests can pass
`allowShortSecret: true` to use fixtures without tripping the guard.
