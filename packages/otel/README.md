# @hyper/otel

OpenTelemetry tracing + SLO histograms for Hyper.

## Install

Components are installed as source into your repo, not pulled from npm:

```bash
bunx hyper add otel
```

Wires the alias `@hyper/otel` to `src/hyper/otel/` (configurable in `hyper.config.json`). See [hyperjs.ai](https://hyperjs.ai) for the full registry.

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
