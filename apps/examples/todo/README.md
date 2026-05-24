# example-todo

A small todo API that exercises the registry workflow end-to-end. The
hand-authored code lives in `src/{adapter,app,schemas,store}.ts`. The
framework components (`@hyper/core`, `@hyper/log`) are pulled into
`src/hyper/` by the CLI from the entries in `hyper.lock.json` — they are
**not** checked into git, so a fresh clone needs to bootstrap them once.

## Setup

The repo-root `bun install` already does this for you (via
`tools/bootstrap-examples.ts`, which runs from the workspace `postinstall`).
If you ever need to re-pin or refresh manually:

```bash
bun run setup     # equivalent to: bunx hyper add core log --force
```

## Develop

```bash
bun run dev       # bun --hot src/adapter.ts
bun test
bun run bench
```

## Layout

```
src/
  adapter.ts        # Bun.serve entry
  app.ts            # routes + handlers
  schemas.ts        # zod inputs
  store.ts          # in-memory store
  hyper/            # gitignored — installed by `hyper add`
    core/
    log/
hyper.config.json   # registry url, alias, baseDir
hyper.lock.json     # pinned components + file hashes
```
