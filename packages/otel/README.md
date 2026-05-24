# @hyper/otel

OpenTelemetry tracing + SLO histograms for Hyper.

## Install

```bash
bun add @hyper/otel
```

## Usage

```ts
import { Hyper } from "@hyper/core"
import { otelMiddleware } from "@hyper/otel"

export default new Hyper()
  .use(otelMiddleware())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
