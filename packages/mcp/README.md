# @hyper/mcp

Model Context Protocol (MCP) adapter for Hyper — turn any Hyper app into an MCP server.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add mcp
```

Wires the alias `@hyper/mcp` to `src/hyper/mcp/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper, ok } from "@hyper/core"
import { mcpServer } from "@hyper/mcp"

const app = new Hyper().get("/ping", () => ok({ pong: true }))

const server = mcpServer(app)
Bun.serve({ port: 5174, fetch: server.handle })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
