# Recipe: Session-based auth

`@usehyper/session` implements encrypted, signed-cookie sessions with CSRF
double-submit protection. Works for any classical web app.

## Setup

```ts
import { Database } from "bun:sqlite"
import { Hyper } from "@usehyper/core"
import { csrfGuard, session, sqliteSessions } from "@usehyper/session"

const sessions = sqliteSessions(new Database("sessions.db"))

export default new Hyper()
  .use(session({ store: sessions, secretEnv: "SESSION_SECRET" }))
  .use(csrfGuard())
  .listen(3000)
```

`SESSION_SECRET` must be ≥32 bytes; the session middleware rejects
shorter secrets at boot.

## Login

```ts
import { Hyper, ok, unauthorized } from "@usehyper/core"
import { z } from "zod"

const LoginSchema = z.object({ email: z.string().email(), password: z.string() })

export default new Hyper()
  .post(
    "/auth/login",
    { body: LoginSchema, meta: { authEndpoint: true } },
    async ({ body, ctx }) => {
      const user = await verifyPassword(body.email, body.password)
      if (!user) return unauthorized({ code: "invalid_credentials" })
      await ctx.session.create({ userId: user.id })
      return ok({ id: user.id })
    },
  )
  .listen(3000)
```

## Logout

```ts
.post("/auth/logout", async ({ ctx }) => {
  await ctx.session.destroy()
  return new Response(null, { status: 204 })
})
```

## CSRF

`csrfGuard` only enforces the double-submit check on **established**
sessions. Your login route works without a token; subsequent mutating
requests must include `X-CSRF-Token` matching the `csrf` cookie. The
cookie is issued automatically the first time a session exists.

## Rate-limit auth routes

Add `@usehyper/rate-limit`'s `authRateLimitPlugin` and mark any route
with `meta.authEndpoint: true`:

```ts
import { authRateLimitPlugin } from "@usehyper/rate-limit"

new Hyper().use(authRateLimitPlugin({ max: 5, windowMs: 60_000 }))
```
