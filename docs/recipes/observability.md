# Recipe: OpenTelemetry + structured logging

## Structured logging (built in)

`@hyper/log` is the observability backbone. Every log call becomes a
typed event with a stable shape. Secrets marked via
`env.secrets = [...]` never leak, even in error responses.

```ts
import { log } from "@hyper/log"

route.post("/orders").body(OrderSchema).handle(async ({ body, ctx }) => {
  const order = await ctx.db.orders.insert(body)
  log.event("order.placed", { orderId: order.id, total: order.total })
  return created(order)
})
```

## OpenTelemetry traces + metrics

```ts
import { app } from "@hyper/core"
import { otelMiddleware, sloRecorder } from "@hyper/otel"
import { NodeSDK } from "@opentelemetry/sdk-node"

const sdk = new NodeSDK({ serviceName: "my-api" })
await sdk.start()

export const api = app({
  use: [
    otelMiddleware({ sloBudgets: sloRecorder({ p99: 500 }) }),
  ],
})
```

Every request produces:
- A `server.request` span with attributes for method, route template,
  status, and a handful of standard HTTP semconv fields.
- A histogram `hyper.server.duration` against your SLO budget.
- Breach events (`slo.breach`) when requests overrun budget.

## Correlating logs and traces

`log.event` automatically attaches the current trace + span id when an
OTel context is active. Query your tracing backend and log aggregator
by the same ID.

## Performance gates in CI

```
hyper bench --tests --p50 250 --p95 800
```

Runs the in-process harness against every registered route (non-param
paths) and exits non-zero if any crosses the target. Wire this into CI
to catch latency regressions before deploy.
