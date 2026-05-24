/**
 * `GET /schema.json` — alias for `/schema/hyper-config.json`.
 *
 * The CLI emits this URL into every `hyper.config.json` it scaffolds, so
 * editors that follow `$schema` get IntelliSense + validation out of the
 * box.
 */

import { jsonResponse, SCHEMA_TTL } from "@/lib/cache"
import { HYPER_CONFIG_SCHEMA } from "../../../../tools/registry/schema"

export function GET(): Response {
  return jsonResponse(HYPER_CONFIG_SCHEMA, SCHEMA_TTL)
}
