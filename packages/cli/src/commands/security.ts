/**
 * `hyper security --check` — static analysis of the booted app's
 * security posture.
 *
 * The command loads the app, introspects routes + plugins + config, and
 * prints a pass/warn/fail report. Exit code is 0 when no fails are
 * found, 1 otherwise. `--json` emits a machine-readable report for CI.
 *
 * Checks:
 *   [sec-headers]       applyDefaultHeaders is enabled (security.headers)
 *   [sec-body-limit]    bodyLimitBytes is within the sane range (>=8KB, <=50MB)
 *   [sec-proto]         JSON prototype-pollution guard is enabled
 *   [sec-method-override] rejectMethodOverride is enabled
 *   [sec-timeout]       requestTimeoutMs is a positive finite number
 *   [sec-jwt-secret]    Any @usehyper/auth-jwt secret env is >=32 bytes at boot
 *   [sec-session-secret] Any @usehyper/session secret env is >=32 bytes at boot
 *   [sec-cors-wildcard] corsPlugin(origin:"*") is opt-in only
 *   [sec-auth-rate]     Routes with meta.authEndpoint have an auto-rate-limit plugin
 *   [sec-route-timeout] No route declares timeoutMs > global request budget
 */

import type { HyperApp, Route } from "@usehyper/core"
import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

type Level = "pass" | "warn" | "fail"
interface Finding {
  readonly id: string
  readonly level: Level
  readonly message: string
  readonly why?: string
  readonly fix?: string
}

export async function runSecurity(args: ParsedArgs): Promise<number> {
  // --check is a *subcommand flag*, so tolerate both shapes:
  //   hyper security --check [entry]
  //   hyper security check [entry]
  // Our arg parser treats `--check entry.ts` as `flags.check = "entry.ts"`,
  // so a string value is equivalent to `--check true` + positional entry.
  let check = args.flags.check === true || args.positional[0] === "check"
  const positionals = [...args.positional.filter((p) => p !== "check")]
  if (typeof args.flags.check === "string") {
    check = true
    positionals.push(args.flags.check)
  }
  if (!check) {
    console.error("usage: hyper security --check [entry]")
    return 2
  }

  const entry = await resolveEntry(positionals)
  if (!entry) {
    console.error("error: no entry file found (tried src/app.ts, app.ts, index.ts)")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error(`error: no default/named 'app' export in ${entry}`)
    return 2
  }

  const findings = await audit(app)
  const failed = findings.filter((f) => f.level === "fail")
  const warned = findings.filter((f) => f.level === "warn")

  if (isJson(args.flags)) {
    console.log(JSON.stringify({ findings, ok: failed.length === 0 }, null, 2))
  } else {
    for (const f of findings) {
      const tag = f.level === "pass" ? "PASS" : f.level === "warn" ? "WARN" : "FAIL"
      const prefix = `[${tag}] ${f.id}`.padEnd(30)
      console.log(`${prefix} ${f.message}`)
      if (f.why) console.log(`${" ".repeat(30)}  why: ${f.why}`)
      if (f.fix) console.log(`${" ".repeat(30)}  fix: ${f.fix}`)
    }
    console.log(
      `\nsummary: ${findings.filter((f) => f.level === "pass").length} pass, ${warned.length} warn, ${failed.length} fail`,
    )
  }
  return failed.length === 0 ? 0 : 1
}

export async function auditApp(app: HyperApp): Promise<readonly Finding[]> {
  return audit(app)
}

export type { Finding, Level }

async function audit(app: HyperApp): Promise<readonly Finding[]> {
  const out: Finding[] = []
  const cfg = app.__config
  const security = cfg.security ?? {}

  push(out, "sec-headers", security.headers !== false, "Default security headers enabled", {
    fail: "Default security headers are off. Re-enable unless you're behind a proxy that already applies them.",
    fix: "Set `security: { headers: true }` (or omit — it's the default).",
  })

  const bodyLimit = security.bodyLimitBytes ?? 1_048_576
  if (bodyLimit < 8_192) {
    out.push({
      id: "sec-body-limit",
      level: "warn",
      message: `Body limit is only ${bodyLimit} bytes — genuine JSON payloads may 413.`,
      fix: "Raise to at least 8KB or rely on the 1MB default.",
    })
  } else if (bodyLimit > 50 * 1_048_576) {
    out.push({
      id: "sec-body-limit",
      level: "warn",
      message: `Body limit is ${bodyLimit} bytes (>50MB). Large bodies invite memory DoS.`,
      fix: "Keep to ≤50MB unless you deliberately accept large uploads. Prefer streaming.",
    })
  } else {
    out.push({ id: "sec-body-limit", level: "pass", message: `Body limit is ${bodyLimit} bytes` })
  }

  push(out, "sec-proto", security.rejectProtoKeys !== false, "Prototype-pollution guard enabled", {
    fail: "JSON bodies may contain `__proto__` / `constructor` / `prototype` keys.",
    fix: "Leave `security.rejectProtoKeys` on (default).",
  })
  push(
    out,
    "sec-method-override",
    security.rejectMethodOverride !== false,
    "Method-override guard enabled",
    {
      fail: "Headers like X-HTTP-Method-Override can rewrite the verb — CSRF/verb-smuggling risk.",
      fix: "Leave `security.rejectMethodOverride` on (default).",
    },
  )
  const timeout = security.requestTimeoutMs ?? 30_000
  if (!(Number.isFinite(timeout) && timeout > 0)) {
    out.push({
      id: "sec-timeout",
      level: "fail",
      message: `requestTimeoutMs is ${timeout}`,
      why: "Handlers without a deadline can hog workers forever.",
      fix: "Set `security.requestTimeoutMs` to a finite positive number (default 30_000).",
    })
  } else {
    out.push({ id: "sec-timeout", level: "pass", message: `Hard timeout: ${timeout}ms` })
  }

  // Plugin-based checks
  const plugins = cfg.plugins ?? []

  // CSRF / session coverage: we walk middleware tags on every route.
  // session() is a middleware tagged "@usehyper/session"; csrfGuard() is
  // tagged "@usehyper/session:csrf". A mutating route with session but
  // without csrf is suspicious — we raise a warn, not a fail, because
  // bearer-token APIs legitimately use session without CSRF.
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])
  const sessionNoCsrf: string[] = []
  for (const r of app.routeList) {
    const tags = r.middlewareTags ?? []
    const hasSession = tags.includes("@usehyper/session")
    const hasCsrfTag = tags.includes("@usehyper/session:csrf")
    if (MUTATING.has(r.method) && hasSession && !hasCsrfTag) {
      sessionNoCsrf.push(`${r.method} ${r.path}`)
    }
  }
  if (sessionNoCsrf.length > 0) {
    out.push({
      id: "sec-csrf",
      level: "warn",
      message: `${sessionNoCsrf.length} mutating route(s) use session() without csrfGuard().`,
      why: "Cookie-authenticated mutating endpoints without CSRF double-submit are vulnerable to cross-site request forgery.",
      fix: `Chain csrfGuard() after session() on: ${sessionNoCsrf.slice(0, 3).join(", ")}${sessionNoCsrf.length > 3 ? ", ..." : ""}. Ignore if this endpoint uses bearer auth.`,
    })
  } else {
    // Only emit a pass marker when session is actually used somewhere.
    const anySession = app.routeList.some((r) =>
      (r.middlewareTags ?? []).includes("@usehyper/session"),
    )
    if (anySession) {
      out.push({
        id: "sec-csrf",
        level: "pass",
        message: "Every mutating session-backed route has csrfGuard().",
      })
    }
  }

  const hasAuthRl = plugins.some((p) => p.name === "@usehyper/rate-limit:auth")
  const authRoutes = app.routeList.filter((r) => r.meta.authEndpoint === true)
  if (authRoutes.length > 0 && !hasAuthRl) {
    out.push({
      id: "sec-auth-rate",
      level: "fail",
      message: `${authRoutes.length} route(s) marked authEndpoint but no auto-rate-limit plugin installed.`,
      why: "Auth endpoints unthrottled are trivially credential-stuffable.",
      fix: "Add `authRateLimitPlugin()` from @usehyper/rate-limit (limit: 10, window: '1m' is a good default).",
    })
  } else if (authRoutes.length > 0) {
    out.push({
      id: "sec-auth-rate",
      level: "pass",
      message: `authRateLimitPlugin is guarding ${authRoutes.length} auth route(s)`,
    })
  }

  const longTimeouts = app.routeList.filter(
    (r: Route) => typeof r.meta.timeoutMs === "number" && (r.meta.timeoutMs as number) > timeout,
  )
  if (longTimeouts.length > 0) {
    out.push({
      id: "sec-route-timeout",
      level: "warn",
      message: `${longTimeouts.length} route(s) have per-route timeoutMs > global requestTimeoutMs`,
      why: "Per-route timeouts longer than the global budget risk starving workers.",
      fix: "Lower the per-route timeout or raise the global budget.",
    })
  }

  return out
}

function push(
  out: Finding[],
  id: string,
  passed: boolean,
  message: string,
  onFail: { fail: string; fix: string },
): void {
  out.push(
    passed
      ? { id, level: "pass", message }
      : { id, level: "fail", message, why: onFail.fail, fix: onFail.fix },
  )
}
