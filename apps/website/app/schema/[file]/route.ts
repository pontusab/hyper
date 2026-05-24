/**
 * `GET /schema/<file>.json` — JSON Schemas published at stable URLs.
 *
 *   /schema/hyper-config.json   — config file written by `hyper init`
 *   /schema/registry-item.json  — single-component manifest
 *   /schema/registry.json       — registry index
 */

import { jsonResponse, SCHEMA_TTL } from "@/lib/cache"
import {
  HYPER_CONFIG_SCHEMA,
  REGISTRY_INDEX_SCHEMA,
  REGISTRY_ITEM_SCHEMA,
} from "../../../../../tools/registry/schema"

const SCHEMAS: Readonly<Record<string, unknown>> = {
  "hyper-config.json": HYPER_CONFIG_SCHEMA,
  "registry-item.json": REGISTRY_ITEM_SCHEMA,
  "registry.json": REGISTRY_INDEX_SCHEMA,
}

interface RouteContext {
  readonly params: Promise<{ readonly file: string }>
}

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const { file } = await params
  const schema = SCHEMAS[file]
  if (!schema) return jsonResponse({ error: `unknown schema: ${file}` }, SCHEMA_TTL, 404)
  return jsonResponse(schema, SCHEMA_TTL)
}
