# @usehyper/testing

Testing helpers for Hyper apps — app.test, fakeRequest, matchers, memory stores, fuzz.

## Install

```bash
bun add @usehyper/testing
```

## Usage

```ts
import { assertResponse, call } from "@usehyper/testing"
const res = await call(api, "GET", "/")
assertResponse(res).isOk()
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
