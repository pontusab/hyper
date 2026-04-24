# @usehyper/otel

OpenTelemetry tracing + SLO histograms for Hyper.

## Install

```bash
bun add @usehyper/otel
```

## Usage

```ts
import { otelMiddleware } from "@usehyper/otel"
app({ use: [otelMiddleware()] })
```

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
