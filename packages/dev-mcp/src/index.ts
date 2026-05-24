/**
 * @hyper/dev-mcp — dev-time MCP surface mounted at /.hyper/mcp.
 *
 * Zero prod exposure: the plugin becomes a no-op unless `enabled: true`
 * or `NODE_ENV !== "production"`. `hyper build` strips it automatically
 * because the plugin short-circuits to an empty object in production
 * envs (see `devMcpPlugin`).
 */

export { buildTools, devMcpPlugin, DevRecorder } from "./plugin.ts"
export type { DevMcpConfig, DevTool, RecordedError, RecordedRequest } from "./plugin.ts"
