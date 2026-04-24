# Secure-by-default baseline

Hyper boots with a conservative security posture. Nothing listed here
requires configuration — it's the default for every `new Hyper()`.

## Response hardening

| Header | Default | Why |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME sniffing on browsers |
| `X-Frame-Options` | `DENY` | Stops clickjacking for API origins |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Tight referrer for links out |
| `Cross-Origin-Opener-Policy` | `same-origin` | Process isolation for browsing contexts |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks cross-origin asset loads by default |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` on HTTPS when `NODE_ENV=production` | HSTS never leaks on localhost/dev |
| `Server` | suppressed | Zero footprinting |

Content Security Policy is opt-in via `@usehyper/csp` (sensible strict
API defaults + nonce support for HTML-serving apps).

## Request hardening

- **1 MB body limit** (overridable per route) with early rejection.
- **JSON prototype-pollution guard** strips `__proto__`, `constructor`,
  `prototype` on decode.
- **Path traversal guard** on route params (`..`, encoded variants).
- **Method-override rejection** — `X-HTTP-Method-Override`,
  `X-Method-Override`, `_method` query/param all return
  `400 method_override_rejected`. Nothing rewrites the verb.
- **Request timeout** — global `30s` default; override per-route via
  `meta.timeoutMs`.
- **Explicit CORS** — never `*` by accident. `@usehyper/cors` refuses
  any config that would emit `*` + `credentials: true`, and rejects
  bare `*` unless you set `allowAnyOrigin: true`.

## Secrets & auth

- **JWT secrets** must be ≥32 bytes (`@usehyper/auth-jwt`). Pass
  `allowShortSecret: true` only in tests.
- **Session secrets** must be ≥32 bytes (`@usehyper/session`). Same
  escape hatch exists for tests.
- **CSRF double-submit** via `csrfGuard` middleware — only enforced on
  already-established sessions, so logins still work. Token lives in a
  `csrf` cookie and must echo in `X-CSRF-Token`.
- **Auth rate-limit plugin** — mark endpoints with
  `meta: { authEndpoint: true }` to opt into automatic per-route rate
  limits. Returns `429 auth_rate_limit_exceeded` as a proper
  `HyperError`.

## Static analysis — `hyper security --check`

```bash
hyper security --check
hyper security --check --json | jq
```

Reports pass/warn/fail for the posture above plus common
misconfigurations (disabled headers, weak timeouts, missing auth rate
limits, disabled method-override guard). Exits non-zero on any `fail`
— run this in CI.

## Overriding defaults

Defaults are chosen so that you don't have to think about them. Every
override exists, but it's off the happy path:

```ts
import { Hyper } from "@usehyper/core"

export default new Hyper({
  security: {
    rejectMethodOverride: false,         // default: true
    requestTimeoutMs: 5_000,             // default: 30_000
    hstsEnv: ["production", "staging"],  // default: "production"
  },
}).listen(3000)
```

The framework philosophy: unsafe has to be typed out.
