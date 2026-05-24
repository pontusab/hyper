# @hyper/testing

Testing helpers for Hyper apps — `call`, matchers, memory stores, fuzz.

## Install

```bash
bun add -d @hyper/testing
```

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
