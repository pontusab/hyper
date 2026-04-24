# @hyper/csp

Content-Security-Policy + sibling headers (CSP, CORP, COEP, COOP, Report-To) for Hyper.

## Install

```bash
bun add @hyper/csp
```

## Usage

```ts
import { cspPlugin } from "@hyper/csp"
app({ plugins: [cspPlugin({ strictApi: true })] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
