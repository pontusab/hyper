/**
 * `GET /r/<name>.json`             — latest manifest (SWR-cached).
 * `GET /r/<name>@<version>.json`   — versioned manifest (immutable).
 *
 * The route segment captures the whole `<name>[@<version>].json` string and
 * we parse it here. `@` is allowed unencoded in URL path segments per
 * RFC 3986, so `core@0.1.0.json` reaches us verbatim.
 */

import { FRESH, IMMUTABLE, jsonResponse } from "@/lib/cache"
import { loadManifests } from "@/lib/manifests"
import { REGISTRY_ITEM_SCHEMA_URL } from "../../../../../tools/registry/schema"

interface RouteContext {
  readonly params: Promise<{ readonly file: string }>
}

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const { file } = await params
  const match = /^([^@]+?)(?:@(.+))?\.json$/.exec(file)
  if (!match) return jsonResponse({ error: `bad path: ${file}` }, FRESH, 404)

  const name = decodeURIComponent(match[1]!)
  const version = match[2] ? decodeURIComponent(match[2]) : null

  const { byName } = await loadManifests()
  const m = byName.get(name)
  if (!m) return jsonResponse({ error: `component not found: ${name}` }, FRESH, 404)

  if (version === null) {
    return jsonResponse({ $schema: REGISTRY_ITEM_SCHEMA_URL, ...m }, FRESH)
  }
  if (version !== m.version) {
    return jsonResponse(
      { error: `version not available: ${name}@${version}`, latest: m.version },
      IMMUTABLE,
      404,
    )
  }
  return jsonResponse({ $schema: REGISTRY_ITEM_SCHEMA_URL, ...m }, IMMUTABLE)
}
