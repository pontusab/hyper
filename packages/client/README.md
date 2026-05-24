# @hyper/client

Typed RPC client + codegen for Hyper apps. Optional TanStack Query bindings at `@hyper/client/tanstack-query`.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add client
```

Wires the alias `@hyper/client` to `src/hyper/client/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

## Usage

Runtime client:

```ts
import { createClient, fetchTransport } from "@hyper/client"

const c = createClient(fetchTransport({ baseUrl: "https://api.example.com" }))

const res = await c.call({ method: "GET", path: "/users/:id", params: { id: "abc" } })
```

Type-safe client via codegen:

```bash
bun x hyper client ./src/generated/client.ts
```

```ts
import { client } from "./generated/client.ts"
const me = await client.users.show({ id: "abc" })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
