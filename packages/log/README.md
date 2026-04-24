# @usehyper/log

Wide-event structured logger for Hyper — the reference plugin.

One log event per request, attached to `ctx.log`. Pluggable drains (stdout, file, Axiom, memory, BYO). Secrets redacted by default.

## Install

```bash
bun add @usehyper/log
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { hyperLog } from "@usehyper/log"

export default new Hyper()
  .use(hyperLog({ service: "orders" }))
  .get("/health", ({ ctx }) => {
    ctx.log.event("health.check", { ok: true })
    return { ok: true }
  })
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
