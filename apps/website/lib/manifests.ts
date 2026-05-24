/**
 * Manifest source for the registry routes.
 *
 * The catalog is bundled at build time as `./registry-data.ts`, regenerated
 * by:
 *   - the root `postinstall` script after every `bun install`
 *   - the website's `vercel-build` hook at deploy time
 *
 * The result is held in a process-local promise so every request shares
 * one resolution.
 */

import type { RegistryComponent, RegistryIndex } from "../../../tools/registry-types"
import { REGISTRY_COMPONENTS, REGISTRY_INDEX } from "./registry-data"

export type Manifest = RegistryComponent
export type ManifestFile = RegistryComponent["files"][number]
export type IndexEntry = RegistryIndex["components"][number]
export type Index = RegistryIndex

export interface RegistrySnapshot {
  readonly index: Index
  readonly components: readonly RegistryComponent[]
  readonly byName: ReadonlyMap<string, RegistryComponent>
}

let snapshot: RegistrySnapshot | null = null

function build(): RegistrySnapshot {
  const components = Object.values(REGISTRY_COMPONENTS)
  const byName = new Map<string, RegistryComponent>()
  for (const c of components) byName.set(c.name, c)
  return { index: REGISTRY_INDEX, components, byName }
}

export function loadManifests(): Promise<RegistrySnapshot> {
  if (!snapshot) snapshot = build()
  return Promise.resolve(snapshot)
}
