/**
 * HTTP + MCP served from the same process.
 *
 * HTTP → :3000
 * MCP  → :5174 (POST JSON-RPC, same app.invoke() path)
 */

import { mcpServer } from "@hyper/mcp"
import a from "./app.ts"

const http = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: a.routes,
  fetch: a.fetch,
})

const mcp = mcpServer(a, { info: { name: "ai-example", version: "0.0.0" } })
const mcpPort = Number(process.env.MCP_PORT ?? 5174)
const mcpServerHandle = Bun.serve({ port: mcpPort, fetch: mcp.handle })

process.on("SIGTERM", () => {
  http.stop(false)
  mcpServerHandle.stop(false)
})
process.on("SIGINT", () => {
  http.stop(false)
  mcpServerHandle.stop(false)
})

console.log(
  `ai-example http://localhost:${http.port}  mcp http://localhost:${mcpServerHandle.port}`,
)
