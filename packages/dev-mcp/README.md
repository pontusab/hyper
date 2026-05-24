# @hyper/dev-mcp

Dev-mode app-as-MCP server — exposes `/.hyper/mcp` with introspection + replay tools.

## Install

```bash
bun add @hyper/dev-mcp
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { devMcp } from "@hyper/dev-mcp"

const app = new Hyper()
if (process.env.NODE_ENV !== "production") app.use(devMcp())
export default app.listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
