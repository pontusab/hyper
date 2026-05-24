# @hyper/dev-mcp

Dev-mode app-as-MCP server — exposes `/.hyper/mcp` with introspection + replay tools.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add dev-mcp
```

Wires the alias `@hyper/dev-mcp` to `src/hyper/dev-mcp/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

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
