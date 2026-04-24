# @usehyper/testing

Testing helpers for Hyper apps — `call`, matchers, memory stores, fuzz.

## Install

```bash
bun add -d @usehyper/testing
```

## Usage

```ts
import { Hyper, ok } from "@usehyper/core"
import { assertResponse, call } from "@usehyper/testing"

const app = new Hyper().get("/", () => ok({ hello: "world" }))

const res = await call(app, "GET", "/")
assertResponse(res).isOk()
```

`call` accepts both `Hyper` instances and built `HyperApp` values, so the same helper works for unit and integration tests.

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
