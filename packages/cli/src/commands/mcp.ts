/**
 * `hyper mcp` — serve the app over MCP (JSON-RPC).
 * `hyper mcp --audit` — print the exposed surface without serving.
 * `hyper mcp --manifest` — write the manifest JSON to stdout.
 */

import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

export async function runMcp(args: ParsedArgs): Promise<number> {
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
  const mod = (await import("@hyper/mcp")) as typeof import("../../../mcp/src/index.ts")

  if (args.flags.manifest === true) {
    const manifest = app.toMCPManifest()
    console.log(JSON.stringify(manifest, null, 2))
    return 0
  }

  if (args.flags.audit === true) {
    const report = mod.auditMcp(app)
    if (isJson(args.flags)) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(mod.formatAuditHuman(report))
    }
    return 0
  }

  const server = mod.mcpServer(app)
  const port = Number(args.flags.port ?? process.env.PORT ?? 5174)
  const bun = Bun.serve({ port, fetch: server.handle })
  console.log(`MCP server listening on http://localhost:${bun.port}`)
  process.on("SIGTERM", () => bun.stop(false))
  process.on("SIGINT", () => bun.stop(false))
  return await new Promise<number>(() => {})
}
