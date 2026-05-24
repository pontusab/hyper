import { CodePanel } from "@/components/code-panel"
import { Footer } from "@/components/footer"
import { Hero } from "@/components/hero"
import { Letterhead } from "@/components/letterhead"

export default function HomePage() {
  return (
    <main>
      <Letterhead />
      <Hero />

      <DocSection
        id="registry"
        title="THE REGISTRY"
        body={
          <>
            <p>
              The framework is the registry. Every part — router, plugins,
              test helpers, OpenAPI and MCP adapters — is a folder of source
              files. Install what you need; the rest never enters your repo.
              The registry stays an installer, not a runtime dependency.
            </p>
            <p>
              Each install is recorded per-file in{" "}
              <span className="ic">hyper.lock.json</span>. Local edits don't
              block upgrades — <span className="ic">hyper update</span>{" "}
              merges only the deltas you accept, the rest of the file stays
              exactly as you wrote it.
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
              A route is one declaration: path, schemas, errors, handler.
              From it Hyper emits the runtime, an OpenAPI 3.1 document, a
              typed RPC client, and an MCP server. No parallel schema file,
              no decorator metadata, no second source of types.
            </p>
            <p>
              Schemas use any{" "}
              <a href="https://standardschema.dev">Standard Schema</a> library
              — Zod, Valibot, Arktype — directly. Errors declared on the
              route appear as response codes in OpenAPI, a discriminated
              union in the client, and assertions in the test runner.
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
              One composition primitive: <span className="ic">.use()</span>.
              It takes a plugin, a sub-app with its own prefix, an imported
              route file, or a function that decorates the request. The
              router flattens at build time — nesting is organisational, free
              at runtime.
            </p>
            <p>In the registry today:</p>
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
              Built for Bun directly — HTTP server, cookie map, password and
              hash APIs, file primitives. A thin layer on a fast runtime, not
              an abstraction over runtimes you don't ship to.
            </p>
            <p>
              Handlers pay only for what they read. Static responses bypass
              the handler path. Security defaults — HSTS, body limits,
              strict CORS, secret-length floors, CSRF double-submit — are
              audited by <span className="ic">hyper security --check</span>{" "}
              in CI.
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
              One CLI for the whole loop: scaffold, dev (hot reload +
              type-check), test (<span className="ic">.example()</span>{" "}
              contracts + <span className="ic">bun:test</span>), bench,
              build, and the registry (<span className="ic">add</span>,{" "}
              <span className="ic">diff</span>,{" "}
              <span className="ic">update</span>,{" "}
              <span className="ic">list</span>).
            </p>
            <p>
              Every command emits JSON with{" "}
              <span className="ic">--json</span>. Editor integrations, CI,
              and agents read the same surface you do.
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
              Any route can opt into{" "}
              <a href="https://modelcontextprotocol.io">MCP</a> exposure. The
              same schema, validation, and errors run whether the call
              arrives over HTTP or MCP — no second layer of glue.
            </p>
            <p>
              The registry runs an MCP endpoint too. From an editor that
              speaks MCP, installing a Hyper component is the same operation
              as calling a route.
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
