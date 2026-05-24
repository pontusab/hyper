import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * `apps/website/` lives in a Bun workspace — its `next` install resolves up
 * to the repo root's hoisted `node_modules`. Pin `outputFileTracingRoot` so
 * the Next.js CLI doesn't probe parent directories looking for a second
 * lockfile.
 *
 * @type {import("next").NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: join(__dirname, "../.."),
}

export default nextConfig
