# @hyper/testing

Testing helpers for Hyper apps — `call`, matchers, memory stores, fuzz.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add testing
```

Wires the alias `@hyper/testing` to `src/hyper/testing/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

```ts
import { Hyper, ok } from "@hyper/core"
import { assertResponse, call } from "@hyper/testing"

const app = new Hyper().get("/", () => ok({ hello: "world" }))

const res = await call(app, "GET", "/")
assertResponse(res).isOk()
```

`call` accepts both `Hyper` instances and built `HyperApp` values, so the same helper works for unit and integration tests.

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
