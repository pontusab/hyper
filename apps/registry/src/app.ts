/**
 * The hyperjs.ai app. Dogfoods Hyper end-to-end.
 *
 *   GET  /                                browse UI
 *   GET  /c/<name>                        per-component page (rendered README, files, deps)
 *   GET  /r/index.json                    registry catalog (all latest versions)
 *   GET  /r/<name>.json                   latest manifest for one component
 *   GET  /r/<name>@<version>.json         versioned, immutable manifest
 *   GET  /schema.json                     JSON Schema for hyper.config.json (alias)
 *   GET  /schema/hyper-config.json        JSON Schema for hyper.config.json
 *   GET  /schema/registry-item.json       JSON Schema for component manifests
 *   GET  /schema/registry.json            JSON Schema for the index
 *   GET  /healthz                         liveness check
 *   *    /mcp                             MCP JSON-RPC endpoint
 *
 * Manifests are built in memory at cold start (see `manifests.ts`) and the
 * Vercel CDN holds the responses according to the `cache-control` headers we
 * set below:
 *
 *   - versioned manifests are immutable (`s-maxage=1y`)
 *   - the latest alias + index use SWR (5min fresh, 1day grace)
 *   - HTML pages use SWR too so updates propagate within a few minutes
 *
 * On a cache hit the CDN serves the response without invoking the function,
 * so the on-demand cost only applies to the first request after a deploy.
 */

import { Hyper, ok } from "@hyper/core"
import type { RegistryComponent, RegistryIndex } from "../../../tools/registry-types.ts"
import {
  HYPER_CONFIG_SCHEMA,
  REGISTRY_INDEX_SCHEMA,
  REGISTRY_INDEX_SCHEMA_URL,
  REGISTRY_ITEM_SCHEMA,
  REGISTRY_ITEM_SCHEMA_URL,
} from "../../../tools/registry/schema.ts"
import { loadManifests } from "./manifests.ts"
import { handleMcp } from "./mcp.ts"
import { renderComponentPage } from "./pages/component.ts"
import { renderHome } from "./pages/home.ts"

const IMMUTABLE = "public, max-age=0, s-maxage=31536000, immutable"
const FRESH = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
const SCHEMA_TTL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"

function jsonResponse(value: unknown, cacheControl: string, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
    },
  })
}

function htmlResponse(body: string, cacheControl: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
    },
  })
}

/** Inject the public schema URL into a manifest just before serializing. */
function withItemSchema(c: RegistryComponent): RegistryComponent & { $schema: string } {
  return { $schema: REGISTRY_ITEM_SCHEMA_URL, ...c }
}

function withIndexSchema(i: RegistryIndex): RegistryIndex & { $schema: string } {
  return { $schema: REGISTRY_INDEX_SCHEMA_URL, ...i }
}

const app = new Hyper()
  .get("/", async () => {
    const { index } = await loadManifests()
    return htmlResponse(renderHome(index), FRESH)
  })
  .get("/c/:name", async ({ params }) => {
    const { byName } = await loadManifests()
    const m = byName.get(params.name)
    if (!m) {
      return htmlResponse(
        `<!doctype html><meta charset="utf-8"><title>not found</title><p>Component <code>${params.name}</code> not found. <a href="/">back to registry</a></p>`,
        "public, max-age=0, s-maxage=60",
        404,
      )
    }
    return htmlResponse(renderComponentPage(m), FRESH)
  })

  .get("/r/index.json", async () => {
    const { index } = await loadManifests()
    return jsonResponse(withIndexSchema(index), FRESH)
  })
  .get("/r/:name@:version.json", async ({ params }) => {
    const { byName } = await loadManifests()
    const m = byName.get(params.name)
    if (!m) {
      return jsonResponse({ error: `component not found: ${params.name}` }, FRESH, 404)
    }
    if (params.version !== m.version) {
      return jsonResponse(
        {
          error: `version not available: ${params.name}@${params.version}`,
          latest: m.version,
        },
        IMMUTABLE,
        404,
      )
    }
    return jsonResponse(withItemSchema(m), IMMUTABLE)
  })
  .get("/r/:name.json", async ({ params }) => {
    const { byName } = await loadManifests()
    const m = byName.get(params.name)
    if (!m) {
      return jsonResponse({ error: `component not found: ${params.name}` }, FRESH, 404)
    }
    return jsonResponse(withItemSchema(m), FRESH)
  })

  .get("/schema.json", () => jsonResponse(HYPER_CONFIG_SCHEMA, SCHEMA_TTL))
  .get("/schema/hyper-config.json", () => jsonResponse(HYPER_CONFIG_SCHEMA, SCHEMA_TTL))
  .get("/schema/registry-item.json", () => jsonResponse(REGISTRY_ITEM_SCHEMA, SCHEMA_TTL))
  .get("/schema/registry.json", () => jsonResponse(REGISTRY_INDEX_SCHEMA, SCHEMA_TTL))

  .get("/healthz", () => ok({ ok: true }))

  // MCP — both verbs route through the dedicated handler. GET is a help page
  // (lists available tools); POST is the JSON-RPC endpoint. Hyper pre-parses
  // the POST body, so we forward it explicitly to avoid double-consuming.
  .get("/mcp", ({ req }) => handleMcp(req))
  .post("/mcp", ({ req, body }) => handleMcp(req, body))
  .build()

export default app
