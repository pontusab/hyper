# @usehyper/mcp

Model Context Protocol (MCP) adapter for Hyper — turn any Hyper app into an MCP server.

## Install

```bash
bun add @usehyper/mcp
```

## Usage

```ts
import { Hyper, ok } from "@usehyper/core"
import { mcpServer } from "@usehyper/mcp"

const app = new Hyper().get("/ping", () => ok({ pong: true }))

const server = mcpServer(app)
Bun.serve({ port: 5174, fetch: server.handle })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
