/**
 * Built-in templates (inline strings so the CLI stays zero-asset).
 *
 * - minimal: one app file + adapter + tests scaffolding.
 * - api: minimal + @hyper/log wired + /health + example CRUD route.
 */

export interface Template {
  readonly name: string
  readonly files: Readonly<Record<string, string>>
}

const MINIMAL_APP = `import { app, ok, route } from "@hyper/core"

export default app({
  routes: [
    route.get("/health").handle(() => ok({ ok: true })),
    route.get("/hello/:name").handle(({ params }) => ok({ hello: params.name })),
  ],
})
`

const MINIMAL_ADAPTER = `import app from "./app.ts"

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: app.routes,
  fetch: app.fetch,
})

process.on("SIGTERM", () => server.stop(false))
process.on("SIGINT", () => server.stop(false))

console.log(\`listening on http://localhost:\${server.port}\`)
`

const MINIMAL_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
`

const MINIMAL_PKG = `{
  "name": "my-hyper-app",
  "type": "module",
  "scripts": {
    "dev": "hyper dev",
    "build": "hyper build",
    "typecheck": "hyper typecheck",
    "start": "bun src/adapter.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@hyper/core": "latest"
  },
  "devDependencies": {
    "@hyper/cli": "latest",
    "@types/bun": "latest"
  }
}
`

const API_APP = `import { app, ok, route } from "@hyper/core"
import { hyperLog } from "@hyper/log"

const health = route.get("/health").handle(() => ok({ ok: true }))

const listUsers = route.get("/users").handle(() => ok([{ id: "u1", name: "Ada" }]))

const getUser = route
  .get("/users/:id")
  .handle(({ params }) => ok({ id: params.id, name: "Ada" }))

export default app({
  routes: [health, listUsers, getUser],
  plugins: [hyperLog({ service: "my-hyper-app" })],
})
`

export const TEMPLATES: Record<string, Template> = {
  minimal: {
    name: "minimal",
    files: {
      "src/app.ts": MINIMAL_APP,
      "src/adapter.ts": MINIMAL_ADAPTER,
      "tsconfig.json": MINIMAL_TSCONFIG,
      "package.json": MINIMAL_PKG,
    },
  },
  api: {
    name: "api",
    files: {
      "src/app.ts": API_APP,
      "src/adapter.ts": MINIMAL_ADAPTER,
      "tsconfig.json": MINIMAL_TSCONFIG,
      "package.json": MINIMAL_PKG.replace(
        '"@hyper/core": "latest"',
        '"@hyper/core": "latest",\n    "@hyper/log": "latest"',
      ),
    },
  },
}
