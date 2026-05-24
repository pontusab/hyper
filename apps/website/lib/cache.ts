/**
 * Cache-Control TTLs used by the registry route handlers.
 *
 *   IMMUTABLE  — versioned manifests; Vercel CDN holds them forever.
 *   FRESH      — latest aliases, the index, HTML pages. SWR with 5min fresh,
 *                1day grace.
 *   SCHEMA_TTL — JSON Schema endpoints. SWR with 1h fresh, 1day grace.
 *
 * On a cache hit Vercel serves directly from the edge with no function
 * invocation, so the on-demand cost only applies to the first request after
 * a deploy.
 */

export const IMMUTABLE = "public, max-age=0, s-maxage=31536000, immutable"
export const FRESH = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
export const SCHEMA_TTL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"

export function jsonResponse(value: unknown, cacheControl: string, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
    },
  })
}
