export const HELP_TEXT = `hyper — fast, opinionated, AI-native API framework

Usage:
  hyper <command> [options]

Project commands:
  init [template]      Scaffold a new app (templates: minimal, api). Writes hyper.config.json + tsconfig paths, then installs core.
  dev [entry]          Run app with Bun hot reload + tsgo --watch (--test for bun test --watch)
  build [entry]        Bundle app + emit route graph
  openapi [out]        Emit OpenAPI 3.1 spec
  test                 Run .example() contracts + bun:test (--fuzz, --types, --reporter=junit)
  typecheck            Run tsgo --noEmit against the project
  env --check          Validate env against declared schema
  routes [entry]       Print the route graph (--json for machine output)
  client <out> [entry] Emit a typed RPC client
  mcp [entry]          Serve dev MCP view (use --audit to print exposed surface)
  bench [entry]        Run the in-process latency benchmark
  security --check     Audit secure-by-default posture
  version              Print version + toolchain info

Registry commands:
  add <component>...   Copy components into your repo. Resolves deps + rewrites imports.
                       Flags: --info  --force  --dry-run  --json  --list
  diff <component>     Show drift between local files and the registry
  update [component]   Update installed components to the latest registry version
                       Flags: --force  --dry-run
  list [query]         List / search the registry catalog (--json)
  search <query>       Alias of \`hyper list <query>\`

Flags:
  --json               Machine-readable output for scripting/CI
  --help, -h           Show this help

Environment:
  HYPER_REGISTRY_URL   Override the registry base URL (default: https://hyperjs.ai)
  HYPER_SKIP_LISTEN    Set automatically by introspection commands; user code can opt-out
`

export function runHelp(): number {
  console.log(HELP_TEXT)
  return 0
}
