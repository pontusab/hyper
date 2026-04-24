# ADR 0001 — v0 roadmap

- **Status**: Accepted
- **Date**: 2026-04-23
- **Supersedes**: n/a

## Context

Hyper targets four milestones (M0 skeleton → M3 production) with a
hybrid distribution model (npm core + Shadcn-style copied files).

## Decision

We will ship in four milestones:

1. **M0** — `@hyper/core` minimal (route builder, dev router, Bun adapter).
2. **M1** — Composition, context, env, plugin protocol via `@hyper/log`,
   CLI, `@hyper/testing`, canonical `apps/examples/todo`.
3. **M2** — Multi-protocol projection, `@hyper/client`, `@hyper/mcp`,
   resources/versioning, `@hyper/trpc`, Server Actions.
4. **M3** — OpenAPI, reliability plugins, dev MCP, compiled build
   pipeline, shadcn CLI + benchmarks, security audit.

## Consequences

- One-package-at-a-time discipline; no package lands without tests.
- `@hyper/core` is the only hard dependency across the ecosystem.
- ORM/DB integrations live as docs recipes + `@hyper/log` subpath
  exports, never as separate `@hyper/*-orm` packages.
