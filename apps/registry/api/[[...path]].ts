/**
 * Vercel Function entry — runs the Hyper app on Bun runtime.
 *
 * Every path goes through this function, including `/r/*.json` and
 * `/schema.json`. The function sets its own `cache-control` headers so
 * Vercel's CDN can hold immutable manifests forever and SWR-cache the
 * latest aliases. After the first request after a deploy, the CDN serves
 * subsequent requests directly from the edge with no function invocation.
 */

import app from "../src/app.ts"

export const config = { runtime: "bun" }

export default function handler(req: Request): Response | Promise<Response> {
  return app.fetch(req)
}
