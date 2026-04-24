# @hyper/mcp

Model Context Protocol (MCP) adapter for Hyper.

## Install

```bash
bun add @hyper/mcp
```

## Usage

```ts
import { mcpServer } from "@hyper/mcp"
const server = mcpServer(api)
Bun.serve({ port: 5174, fetch: server.handle })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
