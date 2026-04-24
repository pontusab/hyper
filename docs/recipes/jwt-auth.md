# Recipe: JWT auth

Use `@usehyper/auth-jwt` for bearer-token APIs. HS256 or RS256.

## Setup

```ts
import { Hyper, ok } from "@usehyper/core"
import { authJwtPlugin } from "@usehyper/auth-jwt"

export default new Hyper()
  .use(authJwtPlugin({ secretEnv: "JWT_SECRET", alg: "HS256" }))
  .get("/me", ({ ctx }) => ok({ id: ctx.user!.sub, scope: ctx.user!.scope }))
  .listen(3000)
```

Declare `JWT_SECRET` (≥32 bytes, HS256) or `JWT_PUBLIC_KEY` (RS256) in
your env schema so the secret guard catches bad config at boot.

## Route-level opt-in (no plugin)

```ts
import { Hyper, ok } from "@usehyper/core"
import { authJwt } from "@usehyper/auth-jwt"

export default new Hyper()
  .use("/private", new Hyper().use(authJwt({ secretEnv: "JWT_SECRET" }))
    .get("/", ({ ctx }) => ok({ hello: ctx.user!.sub })))
  .listen(3000)
```

## Issuing tokens in tests

`@usehyper/testing` ships `signJwtHS256`:

```ts
import { bearerAsUser, signJwtHS256 } from "@usehyper/testing"

const token = await signJwtHS256({ sub: "u1", scope: ["admin"] }, SECRET_32_BYTES)
const res = await app.fetch(
  new Request("http://localhost/me", { headers: { authorization: `Bearer ${token}` } }),
)
```

Or skip the JWT entirely and stub the user via a test-only decorator:

```ts
import { Hyper } from "@usehyper/core"
import { bearerAsUser } from "@usehyper/testing"

const testApp = new Hyper().decorate(() => bearerAsUser({ sub: "u1", scope: ["admin"] }))
```

## Secret enforcement

Secrets shorter than 32 bytes are rejected at boot. Tests can pass
`allowShortSecret: true` to use fixtures without tripping the guard.
