# @usehyper/cli

Hyper CLI — dev server, OpenAPI export, contract tests, security scan, benchmarks.

## Install

```bash
bun add -d @usehyper/cli
```

## Usage

```bash
bun x hyper dev                 # hot-reload dev server
bun x hyper routes              # print the route table
bun x hyper test                # run .example() contracts
bun x hyper test --fuzz --types # fuzz schemas + type-level assertions
bun x hyper security --check    # static security audit
bun x hyper openapi --out openapi.json
bun x hyper bench --tests
```

`hyper dev` and every introspection command set `HYPER_SKIP_LISTEN=1` before importing your app, so the same `app.ts` works as both server entrypoint and CLI input.

## Docs

See the [main README](../../README.md) and [docs/](../../docs) for guides and integration recipes.

## License

MIT
