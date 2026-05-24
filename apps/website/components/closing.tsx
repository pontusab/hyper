/**
 * Closing block — a centered ASCII-art diagram showing inputs flowing
 * through the Hyper core into outputs, then a one-line CTA. Pure text
 * inside a `<pre>`; renders identically in any monospace context.
 */
const DIAGRAM = String.raw`
        +-------------------+        +--------------------+        +-------------------+
        |   HTTP REQUEST    |---+    |                    |    +---|   JSON RESPONSE   |
        +-------------------+   |    |                    |    |   +-------------------+
        +-------------------+   |    |                    |    |   +-------------------+
        |   SERVER ACTION   |---+    |                    |    +---|  TYPED RPC REPLY  |
        +-------------------+   |    |                    |    |   +-------------------+
                                +--->|    NEW HYPER()     |--->|
        +-------------------+   |    |                    |    |   +-------------------+
        |     MCP CALL      |---+    |  routes . types    |    +---|   MCP TOOL CALL   |
        +-------------------+   |    |  openapi . mcp     |    |   +-------------------+
        +-------------------+   |    |                    |    |   +-------------------+
        |   OPENAPI CLIENT  |---+    |                    |    +---|       STREAM      |
        +-------------------+        +--------------------+        +-------------------+
`

export function Closing() {
  return (
    <section className="mx-auto max-w-[1100px] border-t border-[var(--color-line)] px-6 py-16 sm:px-10">
      <h2 className="h-doc h-doc-1 mb-6">FROM ONE ROUTE DEFINITION</h2>
      <pre className="overflow-x-auto text-[11px] leading-tight text-[var(--color-fg)]">
        {DIAGRAM}
      </pre>
      <div className="mt-10 text-[12px] uppercase tracking-wide">
        <span className="text-[var(--color-fg-muted)]">[</span>{" "}
        <a href="/docs">READ THE DOCS</a> <span className="text-[var(--color-fg-muted)]">/</span>{" "}
        <a href="https://hyperjs.ai">BROWSE THE REGISTRY</a>{" "}
        <span className="text-[var(--color-fg-muted)]">]</span>
      </div>
    </section>
  )
}
