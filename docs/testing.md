# Testing Hyper apps

Hyper ships `@usehyper/testing` with everything you need to write fast, deterministic
tests against an in-process app — no sockets, no ports, no fixtures to wire up.

```ts
import { app, route, ok } from "@usehyper/core"
import { assertResponse, call, asUser, memoryKv } from "@usehyper/testing"

const api = app({
  routes: [route.get("/me").handle(({ ctx }) => ok({ id: ctx.user.id }))],
})

const test = api.test({ ctx: asUser({ id: "u1", roles: ["admin"] }) })
const res = await call(test, "GET", "/me")
assertResponse(res).isOk().jsonMatches({ id: "u1" })
```

## What you get

| Helper | Use for |
| --- | --- |
| `app.test(overrides)` | Clone the app with swapped env, ctx, plugins |
| `call(app, method, path, init)` | Shortcut for `app.fetch(new Request(...))` |
| `fakeRequest(method, path, init)` | Build a `Request` with JSON body + headers |
| `assertResponse(res)` | Fluent matchers: `isOk`, `isError`, `jsonMatches`, `hasHeader` |
| `asUser({ id, roles })` | Produce a ctx stub satisfying `AppContext["user"]` |
| `memoryKv()` / `memoryDb()` / `memoryRateLimiter()` | In-memory store stand-ins |
| `testClock()` / `useTestClock()` / `advanceTime(ms)` | Deterministic time |
| `captureEvents(app)` | Collect every `log.event()` for assertions |
| `mockPlugin({...})` | One-shot plugin for tests |
| `mockCtx({...})` | Typed `AppContext` stub |
| `snapshotManifest(app)` | Capture OpenAPI / MCP / client for snapshot tests |
| `signJwtHS256(payload, secret)` / `bearerAsUser(...)` | Sign tokens for auth tests |
| `expectTypeOf<X>()` / `expectRoute<R>()` / `expectApp<A>()` | Compile-time assertions |
| `fuzzRoute(app, "POST /users")` | Run the built-in attack corpus |

## Deterministic time

```ts
import { useTestClock, advanceTime } from "@usehyper/testing"
useTestClock()
// `Date.now()` and `setTimeout` now step forward only when you say so.
advanceTime(5_000)
```

## Structured events

```ts
import { captureEvents } from "@usehyper/testing"
const events = captureEvents(api)
await call(api, "POST", "/orders", { body: { id: "o1" } })
expect(events.find((e) => e.name === "order.placed")).toBeDefined()
```

## Type-level tests

```ts
import { expectTypeOf } from "@usehyper/testing"
expectTypeOf<Input<typeof users.list>>().toEqualTypeOf<void>()
```

## Fuzzing

```ts
import { fuzzRoute } from "@usehyper/testing/fuzz"
const report = await fuzzRoute(api, "POST /users")
expect(report.ok).toBe(true)
```

The built-in corpus covers prototype pollution, path traversal, oversized
payloads, method-override smuggling, malformed JSON, CSRF, and a dozen other
common mistakes. Feed your own via `{ extraCases: [...] }`.

## `hyper test` CLI

```
hyper test                   # example contracts + bun:test
hyper test --fuzz            # + run fuzzRoute against every route
hyper test --types           # + run tsgo --noEmit
hyper test --reporter=junit  # emit test-report.xml
```

## `hyper dev --test`

Run `bun test --watch` alongside the app during development:

```
hyper dev --test
```
