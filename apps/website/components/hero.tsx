import { CodePanel } from "./code-panel"

/**
 * Hero — leads with the unique angle (source distribution, no npm
 * dependency on the framework, code lives in the user's repo) and
 * follows with the multi-output one-liner.
 */
export function Hero() {
  return (
    <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
      <h1 className="h-doc h-doc-1 mb-8">AN API FRAMEWORK FOR BUN, DISTRIBUTED AS SOURCE</h1>

      <div className="space-y-5 text-[13px] leading-[1.7]">
        <p>
          Hyper is an HTTP framework for{" "}
          <a href="https://bun.sh">Bun</a>. There is no{" "}
          <span className="ic">@hyper/core</span> in your{" "}
          <span className="ic">package.json</span>. The CLI copies the
          components you want into{" "}
          <span className="ic">src/hyper/</span> as plain TypeScript — yours
          to read, edit, fork, or delete.{" "}
          <span className="ic">hyper diff</span> and{" "}
          <span className="ic">hyper update</span> keep the upgrade path
          intact.
        </p>
        <p>
          Declare a route once. Hyper emits the runtime, an OpenAPI 3.1
          document, a typed RPC client, and an{" "}
          <a href="https://modelcontextprotocol.io">MCP</a> server from the
          same source.
        </p>
      </div>

      <CodePanel
        code={`> bun create hyper my-app
> bun run dev`}
        running="Hyper listening on http://localhost:3000"
      />
    </section>
  )
}
