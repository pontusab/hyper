/**
 * Component byline — a single mono row listing the components that ship
 * in the registry today. Plain text, no animation.
 */
const COMPONENTS = [
  "core",
  "cors",
  "auth-jwt",
  "session",
  "log",
  "rate-limit",
  "csp",
  "cache",
  "idempotency",
  "otel",
  "compress",
  "msgpack",
  "openapi",
  "openapi-zod",
  "openapi-valibot",
  "openapi-arktype",
  "mcp",
  "dev-mcp",
  "subscribe",
  "trpc",
  "client",
  "testing",
  "agent-rules",
] as const

export function TrustedBy() {
  return (
    <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-6 text-[11px] tracking-wide text-[var(--color-fg-muted)] sm:px-10">
      <span className="uppercase">~ {COMPONENTS.length} components in the registry: </span>
      {COMPONENTS.map((name, i) => (
        <span key={name}>
          {i > 0 ? " · " : ""}
          {name}
        </span>
      ))}
      <span className="uppercase"> ~</span>
    </section>
  )
}
