# ADR 0002 — tsgo (TypeScript 7 native preview) bug tracking

- **Status**: Active
- **Date**: 2026-04-23

## Context

Hyper pins `@typescript/native-preview` (the Corsa / tsgo port) as its
primary typechecker. It is a preview; some features lag behind stable
`typescript@5.x`.

## Pinned version

See `.tsversion`. Currently: `7.0.0-dev.20260423.1`.

## Known gaps and workarounds

| Area | Gap | Workaround |
|---|---|---|
| `--build` / composite references | Not implemented | Flat per-package `tsconfig.json` + `bun run --filter='*' typecheck` |
| `.d.ts` emit stability | Occasional edge cases | `isolatedDeclarations: true` everywhere; fallback to stable `tsc --emitDeclarationOnly` via `TSGO_FALLBACK=1` |
| Language service parity | Some features partial | Recommend "TypeScript Native Preview" VS Code extension; fall back to stable TS server locally |

## Upstream

Bugs filed at [microsoft/typescript-go](https://github.com/microsoft/typescript-go).
Track each with a row below:

| Date | Issue | Workaround landed | Resolved |
|---|---|---|---|

## Escape hatch

If tsgo blocks a land:

```sh
TSGO_FALLBACK=1 bun run typecheck
```

Runs stable `typescript@5.x` via `tsconfig.fallback.json`.
