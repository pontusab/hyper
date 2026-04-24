# @hyper/client

Typed RPC client + codegen for Hyper.

## Install

```bash
bun add @hyper/client
```

## Usage

```ts
import { createClient, fetchTransport } from "@hyper/client"
const c = createClient(fetchTransport({ baseUrl: "/" }))
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
