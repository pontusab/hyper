/**
 * `GET /r/index.json` — registry catalog.
 *
 * Wire format: see `tools/registry-types.ts`.
 *
 * Latest aliases use SWR caching so updates propagate to the edge within
 * five minutes, but the function is rarely invoked thanks to the long
 * stale-while-revalidate window.
 */

import { FRESH, jsonResponse } from "@/lib/cache"
import { loadManifests } from "@/lib/manifests"
import { REGISTRY_INDEX_SCHEMA_URL } from "../../../../../tools/registry/schema"

export async function GET(): Promise<Response> {
  const { index } = await loadManifests()
  return jsonResponse({ $schema: REGISTRY_INDEX_SCHEMA_URL, ...index }, FRESH)
}
