/**
 * `snapshotManifest(app)` — guards the public contract in a single
 * assertion. Snapshots OpenAPI + MCP + client manifests together with a
 * stable structure. A breaking change to any surface fails the snapshot.
 */

import type { HyperApp } from "@usehyper/core"

export interface ManifestSnapshot {
  readonly openapi: unknown
  readonly mcp: unknown
  readonly client: unknown
}

export function snapshotManifest(app: HyperApp): ManifestSnapshot {
  return {
    openapi: app.toOpenAPI({ title: "snapshot", version: "0.0.0" }),
    mcp: app.toMCPManifest(),
    client: app.toClientManifest(),
  }
}
