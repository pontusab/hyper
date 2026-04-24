/**
 * Local registry — the starter set of components `hyper add` can install.
 *
 * Each component is a list of files (path + contents + sha256). The
 * registry is the source of truth; consumers copy the files into their
 * repo and track drift via `hyper diff`.
 *
 * This keeps `hyper add` working entirely offline — no fetch required.
 */

export interface RegistryFile {
  readonly path: string
  readonly contents: string
  readonly sha256: string
}

export interface RegistryComponent {
  readonly name: string
  readonly description: string
  readonly files: readonly RegistryFile[]
  readonly dependencies?: readonly string[]
}

const enc = new TextEncoder()

async function hashString(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function component(
  name: string,
  description: string,
  files: readonly { path: string; contents: string }[],
  dependencies?: readonly string[],
): Promise<RegistryComponent> {
  const hashed = await Promise.all(
    files.map(async (f) => ({
      path: f.path,
      contents: f.contents,
      sha256: await hashString(f.contents),
    })),
  )
  return { name, description, files: hashed, ...(dependencies && { dependencies }) }
}

// Raw component sources --------------------------------------------------

const BUN_ADAPTER = `/**
 * Bun adapter — copied from @hyper/cli registry; edit freely.
 *
 * Uses Bun.serve({ routes }) so param-free routes short-circuit the
 * framework router entirely (the fast path).
 */

import type { HyperApp } from "@hyper/core"

export interface BunAdapterConfig {
  readonly port?: number
  readonly hostname?: string
}

export function startBun(app: HyperApp, config: BunAdapterConfig = {}): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: Number(process.env.PORT ?? config.port ?? 3000),
    ...(config.hostname ? { hostname: config.hostname } : {}),
    routes: app.routes,
    fetch: app.fetch,
    development: process.env.NODE_ENV !== "production",
  })
}
`

const NODE_ADAPTER_STUB = `/**
 * Node adapter stub — fill in with your platform's HTTP server.
 *
 * You can delete this file if you only target Bun.
 */

import type { HyperApp } from "@hyper/core"

export function startNode(_app: HyperApp): void {
  throw new Error("node adapter not implemented yet — see packages/cli/templates.")
}
`

const WORKERS_ADAPTER_STUB = `/**
 * Cloudflare Workers adapter stub.
 */

import type { HyperApp } from "@hyper/core"

export default {
  fetch(req: Request, _env: unknown, _ctx: unknown, app: HyperApp) {
    return app.fetch(req)
  },
}
`

const VERCEL_ADAPTER_STUB = `/**
 * Vercel (edge runtime) adapter stub.
 *
 * import { startVercel } from "./adapters/vercel"
 * export default startVercel(app)
 */

import type { HyperApp } from "@hyper/core"

export function startVercel(app: HyperApp) {
  return (req: Request) => app.fetch(req)
}
`

const LAMBDA_ADAPTER_STUB = `/**
 * AWS Lambda function URL adapter stub.
 */

import type { HyperApp } from "@hyper/core"

export function startLambda(app: HyperApp) {
  return async (event: { rawPath: string; requestContext: { http: { method: string } }; body?: string; headers?: Record<string, string> }) => {
    const url = \`https://lambda\${event.rawPath}\`
    const req = new Request(url, {
      method: event.requestContext.http.method,
      ...(event.body ? { body: event.body } : {}),
      headers: event.headers ?? {},
    })
    const res = await app.fetch(req)
    return {
      statusCode: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.text(),
    }
  }
}
`

const CORS_MW = `/**
 * Copied CORS middleware.
 * Swap @hyper/cors for this if you need to hand-tune behavior.
 */

export { corsPlugin as cors } from "@hyper/cors"
`

const AUTH_RECIPE = `/**
 * Starter auth recipe — HS256 JWT with scope-based authorization.
 *
 * 1. Set env.JWT_SECRET
 * 2. app({ plugins: [authJwtPlugin({ secret: env.JWT_SECRET })] })
 * 3. On protected routes, chain .auth()
 */

export { authJwt, authJwtPlugin, installAuthMethod } from "@hyper/auth-jwt"
`

export async function buildLocalRegistry(): Promise<readonly RegistryComponent[]> {
  return Promise.all([
    component("adapter-bun", "Bun.serve adapter with native routes + graceful shutdown.", [
      { path: "src/adapters/bun.ts", contents: BUN_ADAPTER },
    ]),
    component("adapter-node", "Node.js HTTP adapter stub.", [
      { path: "src/adapters/node.ts", contents: NODE_ADAPTER_STUB },
    ]),
    component("adapter-workers", "Cloudflare Workers adapter stub.", [
      { path: "src/adapters/workers.ts", contents: WORKERS_ADAPTER_STUB },
    ]),
    component("adapter-vercel", "Vercel edge runtime adapter stub.", [
      { path: "src/adapters/vercel.ts", contents: VERCEL_ADAPTER_STUB },
    ]),
    component("adapter-aws-lambda", "AWS Lambda URL adapter stub.", [
      { path: "src/adapters/lambda.ts", contents: LAMBDA_ADAPTER_STUB },
    ]),
    component(
      "cors",
      "Default CORS middleware wired with sane origin allowlist defaults.",
      [{ path: "src/middleware/cors.ts", contents: CORS_MW }],
      ["@hyper/cors"],
    ),
    component(
      "auth",
      "HS256 JWT auth starter.",
      [{ path: "src/middleware/auth.ts", contents: AUTH_RECIPE }],
      ["@hyper/auth-jwt"],
    ),
  ])
}
