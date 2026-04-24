/**
 * @hyper/mcp — exposes declared routes over the Model Context Protocol.
 *
 * Usage:
 *   const mcp = mcpServer(app)
 *   Bun.serve({ port: 5174, fetch: mcp.handle })
 *
 * Routes annotated with `meta.mcp = { description }` are exposed as tools.
 * `hyper mcp --audit` prints the surface before it ships.
 */

export { auditMcp, formatAuditHuman } from "./audit.ts"
export type { AuditReport } from "./audit.ts"
export { mcpServer } from "./server.ts"
export type { McpServer, McpServerConfig } from "./server.ts"
