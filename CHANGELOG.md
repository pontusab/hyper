# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-23

Initial public preview. API shape is expected to be stable for the 0.x
line; behavior changes will be called out in the changelog.

### Added

- Core runtime (`@hyper/core`): fluent `route.<method>(path).body(...).handle(...)`
  builder, Standard Schema validation (zod/valibot/arktype), groups and plain-object
  routers, typed `ctx`, middleware with output access, `app({...})`
  boot with env parsing, `.throws({...})` / `.errors({...})` error catalogs,
  `.example()` contracts, `.actionable()`, `.timeout(ms)`, `.staticResponse(res)`
  for native `Bun.serve` static routes, `app.invoke()` shared dispatch for HTTP
  / RPC / MCP / actions.
- `Hyper` class entrypoint (and `hyper()` factory alias): one polymorphic
  `.use()` composes `Hyper` sub-apps (honoring their own constructor
  `prefix`, or re-prefixed via `.use("/v1", sub)`), `HyperPlugin` instances,
  middleware, single `Route` / `Route[]`, `GroupBuilder` / `RouteGroup`, and
  ESM namespace objects. `.listen(port?)` binds `Bun.serve` with a dev
  banner and SIGTERM/SIGINT drain handlers wired in. CLI tooling sets
  `HYPER_SKIP_LISTEN=1` so the same module acts as both server entrypoint
  and introspection manifest (`hyper openapi`, `hyper routes`, `hyper bench`).
- Secure-by-default baseline: HSTS (production-only), method-override rejection,
  1MB body cap, JSON prototype-pollution guard, path traversal guard, request
  timeouts (global + per-route), strict CORS (`*` is hard-rejected unless
  `allowAnyOrigin: true`), JSON serialization that never echoes back secrets.
- Auth hardening: 32-byte minimum on JWT and session secrets with an explicit
  `allowShortSecret: true` opt-out, CSRF double-submit via `csrfGuard()`
  middleware, automatic rate-limiting of `meta.authEndpoint: true` routes via
  `authRateLimitPlugin`.
- Reliability middleware: `@hyper/idempotency` (Idempotency-Key with caching +
  concurrency lock), `@hyper/cache` (SWR + ETag + stampede protection),
  `@hyper/rate-limit` (token bucket + auth plugin), `@hyper/otel` (tracing +
  SLO recorder), `@hyper/compress` (gzip + brotli content-negotiated),
  `@hyper/csp` (CSP / COEP / COOP with nonce support).
- Persistence: `bun:sqlite` store implementations for cache, idempotency,
  rate-limit, and session.
- Integrations: `@hyper/auth-jwt` (HS256 / RS256 + `route.auth()`),
  `@hyper/session` (encrypted signed-cookie sessions), `@hyper/cors`,
  `@hyper/openapi` with pluggable schema converters (`@hyper/openapi-zod`,
  `@hyper/openapi-valibot`, `@hyper/openapi-arktype`), `@hyper/mcp` JSON-RPC 2.0
  server, `@hyper/client` codegen (with `--result-types` for `Result<T, Errors>`
  tagged unions), `@hyper/trpc` two-way bridge, `@hyper/msgpack`,
  `@hyper/subscribe` (SSE), `@hyper/dev-mcp` (dev-mode introspection server),
  `@hyper/log` structured logger with `/wrap-queries` ORM instrumentation and
  subpath exports for bun-sql / drizzle / prisma.
- Testing (`@hyper/testing`): `app.test()`, `fakeRequest`, `assertResponse`,
  `memoryKv` / `memoryDb` / `memoryRateLimiter`, `testClock`, `captureEvents`,
  `mockPlugin`, `mockCtx`, `snapshotManifest`, `signJwtHS256`, `fuzzRoute`
  with built-in attack corpus, type-level `expectTypeOf` / `expectRoute`.
- CLI (`@hyper/cli`): `init`, `dev --test`, `build`, `openapi`, `test --fuzz
  --types --reporter=junit`, `typecheck`, `env --check --unsafe-print`,
  `routes`, `client <out> --result-types`, `mcp --audit`, `add` / `diff`
  Shadcn-style registry, `bench --tests`, `security --check`, `version`.
- Scaffolder (`create-hyper`): `bun create hyper <app>` with starter templates.
- Documentation: top-level README, getting-started guide, testing guide,
  secure-by-default reference, seven integration recipes.

### Performance

- Zero-allocation hot path: pathname extracted via `indexOf`, `URL` /
  `URLSearchParams` / `Headers` / response-headers `Headers` allocated
  lazily via a shared prototype with getters+setters, precompiled
  middleware chains at route-build time, pre-baked secure headers on
  response helpers with a `finalize()` fast-path, conditional
  `AsyncLocalStorage` wrapping (skipped when no env schema is declared).
- In-process benchmark on the hello app (`hyper bench --tests`):
  **p50 ≈ 2.0 µs, ≈ 410k rps** per simple route on the dev machine,
  heap allocation delta ≈ 1.4 MB across 10k iterations.

### Infrastructure

- Monorepo workspace across 24 packages, all at `0.1.0`.
- 191 tests across 40 files, covering happy paths, secure-default edge
  cases, fuzz corpus, and a real `Bun.serve` end-to-end harness.
- GitHub Actions workflow running test / typecheck / bench --tests /
  security --check gates on every PR.
