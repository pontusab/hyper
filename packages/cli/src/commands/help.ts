export const HELP_TEXT = `hyper — fast, opinionated, AI-native API framework

Usage:
  hyper <command> [options]

Commands:
  init [template]      Scaffold a new app (templates: minimal, api)
  dev [entry]          Run app with Bun hot reload + tsgo --watch (--test for bun test --watch)
  build [entry]        Bundle app + emit route graph (kind="static" marks native Bun.serve routes)
  openapi [out]        Emit OpenAPI 3.1 spec (stdout or file)
  test                 Run .example() contracts + bun:test (--fuzz, --types, --reporter=junit)
  typecheck            Run tsgo --noEmit against the project
  env --check          Validate env against declared schema (--unsafe-print to dump resolved values)
  routes [entry]       Print the route graph (add --json for machine output)
  client <out> [entry] Emit a typed RPC client (.ts + .d.ts, --result-types for Result<T,E> unions)
  mcp [entry]          Serve dev MCP view (use --audit to print exposed surface)
  add <component>      Copy a registry component into your repo (Shadcn-style)
  diff <component>     Show drift between installed files and the registry
  bench [entry]        Run the in-process latency benchmark (--tests to cover every route)
  security --check     Audit secure-by-default posture (exits non-zero on fails)
  version              Print version and toolchain info

Flags:
  --json               Machine-readable output for scripting/CI
  --help, -h           Show this help
`

export function runHelp(): number {
  console.log(HELP_TEXT)
  return 0
}
