import { Closing } from "@/components/closing"
import { CodePanel } from "@/components/code-panel"
import { Footer } from "@/components/footer"
import { Hero } from "@/components/hero"
import { Letterhead } from "@/components/letterhead"
import { TrustedBy } from "@/components/trusted-by"

export default function HomePage() {
  return (
    <main>
      <Letterhead />
      <Hero />
      <TrustedBy />

      <DocSection
        id="registry"
        title="THE REGISTRY"
        body={
          <>
            <p>
              The registry is the framework. Each component — the router,
              every plugin, the testing helpers, the OpenAPI and MCP adapters
              — is a folder of source files you install, read, and edit in
              place. The framework lives in{" "}
              <span className="ic">src/hyper/</span>, not in{" "}
              <span className="ic">node_modules</span>.
            </p>
            <p>
              Most frameworks force a choice: depend on the package and accept
              whatever the maintainer ships, or fork it and lose the upgrade
              path. Hyper keeps both. A per-file lockfile records what was
              installed; <span className="ic">hyper diff</span> shows local
              edits and upstream changes side by side;{" "}
              <span className="ic">hyper update</span> merges only the deltas
              you want.
            </p>
            <p>
              Edit the rate limiter for your infrastructure. Fork the JWT
              plugin for a key store you already operate. Delete the parts of
              the router you don't need. The upgrade path stays intact.
            </p>
          </>
        }
        code={
          <CodePanel
            caption="// terminal"
            code={`> bun create hyper my-app --template api

> hyper add cors auth-jwt session
  + src/hyper/cors/index.ts
  + src/hyper/auth-jwt/index.ts
  + src/hyper/auth-jwt/jwt.ts
  + src/hyper/session/index.ts
  ~ .env.local  (1 secret added: JWT_SECRET)

run:  bun add zod jose

> hyper diff cors
  ok    src/hyper/cors/index.ts
  drift src/hyper/cors/options.ts  (3 local edits)`}
            running="installed cors, auth-jwt, session + transitive deps. updated hyper.lock.json."
          />
        }
      />

      <DocSection
        id="ai"
        title="ONE DEFINITION, MANY OUTPUTS"
        body={
          <>
            <p>
              A route is one declaration: path, schemas, error shapes,
              handler. From it Hyper emits the OpenAPI document, the typed
              client your frontend imports, the MCP server an agent calls,
              and the route graph the bench walks. No parallel schema file,
              no decorator metadata, no second source of types.
            </p>
            <p>
              Schemas come from any{" "}
              <a href="https://standardschema.dev">Standard Schema</a> library
              — Zod, Valibot, Arktype — without an adapter layer. Errors are
              declared on the route, not raised by surprise at runtime: they
              show up in OpenAPI as response codes, in the client as a
              discriminated union, and in the test runner as assertions.
            </p>
          </>
        }
        code={
          <>
            <CodePanel
              caption="// src/app.ts"
              code={`import { Hyper, ok } from "@hyper/core"
import { z } from "zod"

export default new Hyper()
  .get("/health", "OK")
  .post(
    "/users",
    {
      body: z.object({
        name: z.string().min(1),
        email: z.email(),
      }),
      throws: { 409: z.object({ taken: z.string() }) },
    },
    async ({ body }) => {
      return ok({ id: crypto.randomUUID(), ...body })
    },
  )
  .listen(3000)`}
            />
            <CodePanel
              caption="// terminal"
              code={`> hyper openapi > openapi.json     # 3.1 spec
> hyper client ./client.gen.ts     # typed RPC client
> hyper mcp                        # MCP server, no extra config`}
              running="openapi 3.1 written -> openapi.json (12 routes, 5 schemas)"
            />
          </>
        }
      />

      <DocSection
        id="plugins"
        title="PLUGINS AND SUB-APPS"
        body={
          <>
            <p>
              One way to compose: <span className="ic">.use()</span>. It takes
              a plugin, a sub-app with its own prefix, a router file imported
              as an ESM namespace, or a function that decorates the request.
              You grow from one file to a folder of routers without learning
              a new wiring primitive. The router flattens at build time, so
              nesting is organisational — it costs nothing at runtime.
            </p>
            <p>What's in the registry today:</p>
            <ul className="list-none space-y-1 pl-0">
              <li>
                <span className="ic">cors</span> — CORS, with strict wildcard
                rejection when credentials are present
              </li>
              <li>
                <span className="ic">auth-jwt</span> — JWT auth, EdDSA / RS256 /
                HS256, 32-byte secret floor
              </li>
              <li>
                <span className="ic">session</span> — encrypted cookie sessions,
                CSRF double-submit
              </li>
              <li>
                <span className="ic">log</span> — structured logging, header /
                body redaction
              </li>
              <li>
                <span className="ic">rate-limit</span> — sliding window and
                token bucket, per-route override
              </li>
              <li>
                <span className="ic">csp</span> — Content-Security-Policy,
                report-only mode, nonces
              </li>
              <li>
                <span className="ic">cache</span> — RFC 9111-aware route
                caching with conditional revalidation
              </li>
              <li>
                <span className="ic">idempotency</span> — idempotency-key
                handling for write methods
              </li>
              <li>
                <span className="ic">otel</span> — OpenTelemetry traces and
                metrics
              </li>
            </ul>
          </>
        }
        code={
          <CodePanel
            caption="// src/app.ts"
            code={`import { Hyper } from "@hyper/core"
import { corsPlugin } from "@hyper/cors"
import { logPlugin } from "@hyper/log"
import { authJwtPlugin } from "@hyper/auth-jwt"
import { rateLimitPlugin } from "@hyper/rate-limit"

import users from "./routes/users.ts"
import posts from "./routes/posts.ts"

export default new Hyper()
  .use(logPlugin())
  .use(corsPlugin({ origin: ["https://example.com"] }))
  .use(rateLimitPlugin({ window: "1m", max: 60 }))
  .use(authJwtPlugin())
  .use(users)              // honors its own prefix -> /users/*
  .use("/v1", posts)       // re-prefixed       -> /v1/posts/*
  .listen(3000)`}
          />
        }
      />

      <DocSection
        id="runtime"
        title="BUN-NATIVE"
        body={
          <>
            <p>
              Built for Bun, not adapted to it. Hyper uses Bun's primitives
              directly — HTTP server, cookie map, password and hashing APIs,
              file primitives. A thin layer on a fast runtime, not a thick
              layer abstracting over runtimes you don't ship to.
            </p>
            <p>
              Handlers pay only for what they use. A route that doesn't read
              the body never parses it. A static response is mounted on the
              runtime and never enters the handler path.
            </p>
            <p>
              Security is opinionated and audited. HSTS in production, body
              limits, prototype-pollution guards, strict CORS for credentialed
              requests, secret-length floors on auth, CSRF double-submit on
              state-changing methods, rate-limited auth endpoints.{" "}
              <span className="ic">hyper security --check</span> runs the
              checklist in CI. The checklist is a contract: you see exactly
              what defaults you're getting and opt out per-check when you
              genuinely need to.
            </p>
          </>
        }
        code={
          <CodePanel
            caption="// terminal"
            code={`> hyper security --check

  ok  HSTS enabled in production
  ok  body limit <= 1 MB
  ok  prototype-pollution guards active
  ok  CORS rejects wildcard with credentials
  ok  JWT secret >= 32 bytes
  ok  session secret >= 32 bytes
  ok  CSRF double-submit on state-changing methods
  ... 5 more`}
            running="ok - secure-by-default posture intact (12/12 checks)."
          />
        }
      />

      <DocSection
        id="cli"
        title="ONE BINARY"
        body={
          <>
            <p>
              One CLI. It scaffolds projects, runs the dev loop with hot
              reload and incremental type-checking, runs your{" "}
              <span className="ic">.example()</span> contracts alongside{" "}
              <span className="ic">bun:test</span>, and benches every
              endpoint. The same binary handles the registry —{" "}
              <span className="ic">add</span>,{" "}
              <span className="ic">diff</span>,{" "}
              <span className="ic">update</span>,{" "}
              <span className="ic">list</span>. No second tool, no second
              auth flow.
            </p>
            <p>
              Every command emits JSON with{" "}
              <span className="ic">--json</span>. Editor integrations, CI
              checks, deployment scripts, and other agents consume the same
              surface you do at the prompt.
            </p>
          </>
        }
        code={
          <CodePanel
            caption="// hyper --help"
            code={`hyper init [template]      scaffold + auto-install core
hyper dev  [entry]         hot reload + tsgo --watch
hyper build [entry]        bundle + route graph
hyper test                 .example() contracts + bun:test
hyper bench [entry]        per-route latency p50/p99
hyper openapi [out]        OpenAPI 3.1 spec
hyper client  <out>        typed RPC client
hyper mcp     [entry]      MCP server (--audit)
hyper routes  [entry]      print the route graph
hyper security --check     audit the secure-by-default posture

# registry
hyper add <name>...        install components into your repo
hyper diff <name>          show drift vs the registry
hyper update [...names]    bump installed components
hyper list  [query]        browse the catalog`}
          />
        }
      />

      <DocSection
        id="mcp"
        title="MCP AS A PEER OF HTTP"
        body={
          <>
            <p>
              The{" "}
              <a href="https://modelcontextprotocol.io">Model Context Protocol</a>{" "}
              is how agents talk to live systems. Hyper treats it as a peer
              of HTTP, not an add-on. Any route can opt into MCP exposure;
              the same schema, validation, and error path runs whether the
              call arrives over HTTP or MCP. No second layer of glue, no
              second set of tools.
            </p>
            <p>
              The registry runs an MCP endpoint too. The same client that
              calls your app can browse and install Hyper components. From
              an editor that speaks MCP, scaffolding the framework is the
              same operation as calling a route.
            </p>
          </>
        }
        code={
          <>
            <CodePanel
              caption="// src/routes/users.ts"
              code={`import { Hyper, ok } from "@hyper/core"
import { z } from "zod"

export default new Hyper({ prefix: "/users" })
  .post(
    "/",
    {
      body: z.object({ name: z.string(), email: z.email() }),
      mcp: {
        title: "Create user",
        description: "Provision a new tenant user. Sends a welcome email.",
      },
    },
    async ({ body }) => ok({ id: crypto.randomUUID(), ...body }),
  )`}
            />
            <CodePanel
              caption="// ~/.cursor/mcp.json"
              code={`{
  "mcpServers": {
    "my-api":  { "url": "http://localhost:3000/mcp" },
    "hyper":   { "url": "https://hyperjs.ai/mcp" }
  }
}`}
            />
          </>
        }
      />

      <Closing />
      <Footer />
    </main>
  )
}

interface DocSectionProps {
  readonly id: string
  readonly title: string
  readonly body: React.ReactNode
  readonly code: React.ReactNode
}

/**
 * One section in the document. A `## ~ HEADER`, a reading-width prose
 * column, and the supporting code panel(s) below. No alternating
 * layouts, no eyebrows, no panels.
 */
function DocSection({ id, title, body, code }: DocSectionProps) {
  return (
    <section
      id={id}
      className="mx-auto max-w-[860px] scroll-mt-8 border-t border-[var(--color-line)] px-6 py-12 sm:px-10"
    >
      <h2 className="h-doc h-doc-2 mb-6">{title}</h2>
      <div className="space-y-5 text-[13px] leading-[1.7]">{body}</div>
      <div className="mt-6">{code}</div>
    </section>
  )
}
