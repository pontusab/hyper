# Recipe: Session-based auth

`@hyper/session` implements encrypted, signed-cookie sessions with CSRF
double-submit protection. Works for any classical web app.

## Setup

```ts
import { app } from "@hyper/core"
import { session, csrfGuard, sqliteSessions } from "@hyper/session"
import { Database } from "bun:sqlite"

const sessions = sqliteSessions(new Database("sessions.db"))

export const api = app({
  env: {
    schema: /* zod/valibot/arktype, must include SESSION_SECRET (>=32 bytes) */,
    secrets: ["SESSION_SECRET"],
  },
  routes: [/* ... */],
  use: [
    session({ store: sessions, secretEnv: "SESSION_SECRET" }),
    csrfGuard(),
  ],
})
```

## Login

```ts
route
  .post("/auth/login")
  .meta({ authEndpoint: true }) // picked up by authRateLimitPlugin
  .body(LoginSchema)
  .handle(async ({ body, ctx }) => {
    const user = await verifyPassword(body.email, body.password)
    if (!user) return unauthorized()
    await ctx.session.create({ userId: user.id })
    return ok({ id: user.id })
  })
```

## Logout

```ts
route.post("/auth/logout").handle(async ({ ctx }) => {
  await ctx.session.destroy()
  return noContent()
})
```

## CSRF

`csrfGuard` only enforces the double-submit check on **established**
sessions. Your login route works without a token; subsequent mutating
requests must include `X-CSRF-Token` matching the `csrf` cookie. The
cookie is issued automatically the first time a session exists.

## Rate-limit auth routes

Add `@hyper/rate-limit`'s `authRateLimitPlugin` and mark any route with
`meta.authEndpoint: true`:

```ts
import { authRateLimitPlugin } from "@hyper/rate-limit"
app({
  plugins: [authRateLimitPlugin({ max: 5, windowMs: 60_000 })],
})
```
