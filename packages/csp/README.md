# @usehyper/csp

Content-Security-Policy + sibling headers (CSP, CORP, COEP, COOP, Report-To) for Hyper.

## Install

```bash
bun add @usehyper/csp
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { cspPlugin } from "@usehyper/csp"

export default new Hyper()
  .use(cspPlugin({ strictApi: true }))
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
