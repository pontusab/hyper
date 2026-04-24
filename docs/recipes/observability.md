# Recipe: OpenTelemetry + structured logging

## Structured logging (built in)

`@usehyper/log` is the observability backbone. Every log call becomes a
typed event with a stable shape. Secrets marked via
`env.secrets = [...]` never leak, even in error responses.

```ts
import { Hyper, created } from "@usehyper/core"
import { hyperLog } from "@usehyper/log"
import { z } from "zod"

const OrderSchema = z.object({ id: z.string(), total: z.number() })

export default new Hyper()
  .use(hyperLog({ service: "orders" }))
  .post("/orders", { body: OrderSchema }, async ({ body, ctx }) => {
    const order = await ctx.db.orders.insert(body)
    ctx.log.event("order.placed", { orderId: order.id, total: order.total })
    return created(order)
  })
  .listen(3000)
```

## OpenTelemetry traces + metrics

```ts
import { NodeSDK } from "@opentelemetry/sdk-node"
import { Hyper } from "@usehyper/core"
import { otelMiddleware, sloRecorder } from "@usehyper/otel"

const sdk = new NodeSDK({ serviceName: "my-api" })
await sdk.start()

export default new Hyper()
  .use(otelMiddleware({ sloBudgets: sloRecorder({ p99: 500 }) }))
  .listen(3000)
```

Every request produces:
- A `server.request` span with attributes for method, route template,
  status, and standard HTTP semconv fields.
- A histogram `hyper.server.duration` against your SLO budget.
- Breach events (`slo.breach`) when requests overrun budget.

## Correlating logs and traces

`ctx.log.event` automatically attaches the current trace + span id when
an OTel context is active. Query your tracing backend and log aggregator
by the same ID.

## Performance gates in CI

```bash
hyper bench --tests --p50 250 --p95 800
```

Runs the in-process harness against every registered route (non-param
paths) and exits non-zero if any crosses the target. Wire this into CI
to catch latency regressions before deploy.
