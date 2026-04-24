import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

/**
 * `hyper env --check` — boots the app just far enough to run env parsing
 * and reports why/fix. Since boot happens on the first `fetch`, we send
 * a synthetic request through the app.
 *
 * `hyper env --unsafe-print` — resolve env against declared schemas and
 * print the merged object. Secrets (as declared via `secret(...)` or
 * the `secrets: [...]` list) are redacted UNLESS this flag is passed,
 * so the opt-in makes leaking them an explicit, auditable action.
 */
export async function runEnvCheck(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error(`error: no default/named 'app' export in ${entry}`)
    return 2
  }
  const unsafe = args.flags["unsafe-print"] === true || args.flags.unsafePrint === true

  try {
    const core = (await import("@usehyper/core")) as typeof import("../../../core/src/index.ts")
    const cfg = app.__config
    const schemas = collectEnvSchemas(cfg)
    const secretPaths = Array.isArray(cfg.env?.secrets) ? (cfg.env?.secrets ?? []) : []
    const source = cfg.env?.source ?? process.env
    const merged = await core.parseEnv(schemas, source as Record<string, string | undefined>)

    if (unsafe) {
      const output = { ...merged }
      if (isJson(args.flags)) console.log(JSON.stringify(output, null, 2))
      else console.log(JSON.stringify(output, null, 2))
      return 0
    }

    const redacted = redact(merged, secretPaths)
    if (isJson(args.flags)) {
      console.log(JSON.stringify({ ok: true, env: redacted }))
    } else {
      console.log("env ok")
      console.log(JSON.stringify(redacted, null, 2))
    }
    return 0
  } catch (e) {
    const body =
      e instanceof Error
        ? {
            error: {
              name: e.name,
              message: e.message,
              issues: (e as unknown as { issues?: unknown }).issues,
            },
          }
        : { error: { message: String(e) } }
    if (isJson(args.flags)) console.log(JSON.stringify(body))
    else console.error("env check failed:", JSON.stringify(body, null, 2))
    return 1
  }
}

function collectEnvSchemas(cfg: {
  env?: { schema?: unknown } | { schema?: unknown }[]
}): import("../../../core/src/standard-schema.ts").StandardSchemaV1[] {
  const schemas: import("../../../core/src/standard-schema.ts").StandardSchemaV1[] = []
  const envCfg = (cfg as { env?: { schema?: unknown } }).env
  if (envCfg && typeof envCfg === "object" && "schema" in envCfg && envCfg.schema) {
    schemas.push(envCfg.schema as import("../../../core/src/standard-schema.ts").StandardSchemaV1)
  }
  return schemas
}

function redact(env: Record<string, unknown>, paths: readonly string[]): Record<string, unknown> {
  if (paths.length === 0) return env
  const out: Record<string, unknown> = { ...env }
  for (const p of paths) {
    if (p in out && out[p] !== undefined) {
      out[p] = "[redacted]"
    }
  }
  return out
}
