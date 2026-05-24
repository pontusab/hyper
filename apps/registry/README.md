# apps/registry — hyperjs.ai

The Hyper component registry, deployed at https://hyperjs.ai.

## What it serves

| URL                              | Cache (set by the function)                |
| -------------------------------- | ------------------------------------------ |
| `/r/index.json`                  | `s-maxage=300, stale-while-revalidate=86400` |
| `/r/<name>.json`                 | `s-maxage=300, stale-while-revalidate=86400` |
| `/r/<name>@<version>.json`       | `s-maxage=31536000, immutable`             |
| `/schema.json`                   | `s-maxage=3600, stale-while-revalidate=86400` |
| `/`, `/c/<name>`, `/healthz`     | `s-maxage=300, stale-while-revalidate=86400` |
| `* /mcp`                         | dynamic                                    |

There are no checked-in JSON manifests. The Bun runtime function builds every
manifest in memory by walking `packages/*` at cold start, then serves them with
the cache headers above. After the first request post-deploy, the Vercel CDN
holds responses at the edge — versioned manifests effectively forever, the
latest aliases for 5 minutes fresh + 1 day grace.

## Local dev

```bash
cd apps/registry
bun run dev        # http://localhost:3000
```

`bun --hot` reloads the module on source changes, which dumps the in-memory
manifest cache automatically.

## Deploy

GitHub Actions handles production deploys via `.github/workflows/registry.yml`
on every `main` push (and on every release). Required secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set the production domain to `hyperjs.ai` in the Vercel dashboard, point the
A/AAAA records at Vercel, and you're done.

The function bundle pulls in `packages/**/*.{ts,md,json}` and `tools/**/*.ts`
via `vercel.json`'s `includeFiles` glob — that's how the runtime build sees
every component's source.

## Self-hosting

The wire format is documented in [`docs/registry.md`](../../docs/registry.md).
Anyone can fork this directory, point their CLI at the deployed URL via
`HYPER_REGISTRY_URL` (or `hyper.config.json`'s `registryUrl`), and they're
running their own registry.
