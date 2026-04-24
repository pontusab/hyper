# @usehyper/dev-mcp

Dev-mode app-as-MCP server — expose /.hyper/mcp with introspection + replay tools.

## Install

```bash
bun add @usehyper/dev-mcp
```

## Usage

```ts
import { devMcp } from "@usehyper/dev-mcp"
app({ plugins: process.env.NODE_ENV !== "production" ? [devMcp()] : [] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
