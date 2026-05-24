import { CodePanel } from "./code-panel"

/**
 * Hero — opens with the positioning line, then a tight summary of what
 * Hyper does. Three short paragraphs, no marketing prose, no
 * connective tissue.
 */
export function Hero() {
  return (
    <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
      <h1 className="h-doc h-doc-1 mb-8">AN API FRAMEWORK FOR BUN, DISTRIBUTED AS SOURCE</h1>

      <div className="space-y-5 text-[13px] leading-[1.7]">
        <p>
          Hyper is an HTTP framework for{" "}
          <a href="https://bun.sh">Bun</a>. The CLI copies the components you
          want into <span className="ic">src/hyper/</span>. There is no{" "}
          <span className="ic">@hyper/core</span> in your{" "}
          <span className="ic">package.json</span>, no runtime dependency on
          the framework. The code is yours: read it, edit it, fork the JWT
          plugin, replace half the router.{" "}
          <span className="ic">hyper diff</span> shows what changed upstream,{" "}
          <span className="ic">hyper update</span> merges only the deltas you
          want.
        </p>
        <p>
          A route is one chained declaration — path, schemas, error shapes,
          handler. From the same source Hyper emits an OpenAPI 3.1 document, a
          typed RPC client, and an{" "}
          <a href="https://modelcontextprotocol.io">MCP</a> server. No
          parallel schema file. No decorator metadata. No second source of
          types.
        </p>
      </div>

      <CodePanel
        caption="// installation"
        code={`> bun create hyper my-app
> cd my-app && bun install
> bun run dev`}
        running="Hyper listening on http://localhost:3000"
      />
    </section>
  )
}
