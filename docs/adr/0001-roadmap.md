# ADR 0001 — v0 roadmap

- **Status**: Accepted
- **Date**: 2026-04-23
- **Supersedes**: n/a

## Context

Hyper targets four milestones (M0 skeleton → M3 production) with a
hybrid distribution model (npm core + Shadcn-style copied files).

## Decision

We will ship in four milestones:

1. **M0** — `@usehyper/core` minimal (route builder, dev router, Bun adapter).
2. **M1** — Composition, context, env, plugin protocol via `@usehyper/log`,
   CLI, `@usehyper/testing`, canonical `apps/examples/todo`.
3. **M2** — Multi-protocol projection, `@usehyper/client`, `@usehyper/mcp`,
   resources/versioning, `@usehyper/trpc`, Server Actions.
4. **M3** — OpenAPI, reliability plugins, dev MCP, compiled build
   pipeline, shadcn CLI + benchmarks, security audit.

## Consequences

- One-package-at-a-time discipline; no package lands without tests.
- `@usehyper/core` is the only hard dependency across the ecosystem.
- ORM/DB integrations live as docs recipes + `@usehyper/log` subpath
  exports, never as separate `@usehyper/*-orm` packages.
