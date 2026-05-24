# @hyper/csp

Content-Security-Policy + sibling headers (CSP, CORP, COEP, COOP, Report-To) for Hyper.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add csp
```

Wires the alias `@hyper/csp` to `src/hyper/csp/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper } from "@hyper/core"
import { cspPlugin } from "@hyper/csp"

export default new Hyper()
  .use(cspPlugin({ strictApi: true }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
