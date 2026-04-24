# @usehyper/otel

OpenTelemetry tracing + SLO histograms for Hyper.

## Install

```bash
bun add @usehyper/otel
```

## Usage

```ts
import { Hyper } from "@usehyper/core"
import { otelMiddleware } from "@usehyper/otel"

export default new Hyper()
  .use(otelMiddleware())
  .listen(3000)
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
