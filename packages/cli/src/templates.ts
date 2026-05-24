/**
 * Built-in scaffolding templates.
 *
 * After `hyper init`, the CLI runs `hyper add core` to copy the framework
 * source into `<baseDir>/core/`. Templates therefore have NO `@usehyper/*`
 * runtime deps — imports use `@hyper/core` and resolve via tsconfig paths.
 */

export interface Template {
  readonly name: string
  /** Files emitted by `hyper init`. Paths are relative to the project root. */
  readonly files: Readonly<Record<string, string>>
  /** Components installed via `hyper add` after the files are written. */
  readonly components: readonly string[]
  /**
   * Peer deps that should land in `package.json` immediately. The CLI prints
   * a one-liner suggesting `bun add` for these.
   */
  readonly extraPeerDeps?: Readonly<Record<string, string>>
}

const MINIMAL_APP = `import { Hyper, ok } from "@hyper/core"

export default new Hyper()
  .get("/health", () => ok({ ok: true }))
  .get("/hello/:name", ({ params }) => ok({ hello: params.name }))
  .listen(Number(process.env.PORT ?? 3000))
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
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@types/bun"],
    "paths": {
      "@hyper/*": ["./src/hyper/*", "./src/hyper/*/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
`

const MINIMAL_PKG = `{
  "name": "my-hyper-app",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --hot src/app.ts",
    "start": "bun src/app.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.6.0"
  }
}
`

const API_APP = `import { Hyper, ok, route } from "@hyper/core"
import { hyperLog } from "@hyper/log"

const health = route.get("/health").handle(() => ok({ ok: true }))
const listUsers = route.get("/users").handle(() => ok([{ id: "u1", name: "Ada" }]))
const getUser = route
  .get("/users/:id")
  .handle(({ params }) => ok({ id: params.id, name: "Ada" }))

export default new Hyper()
  .use(hyperLog({ service: "my-hyper-app" }))
  .use([health, listUsers, getUser])
  .listen(Number(process.env.PORT ?? 3000))
`

const HEALTH_TEST = `import { describe, expect, test } from "bun:test"
import app from "../src/app.ts"

describe("app", () => {
  test("GET /health returns ok", async () => {
    const res = await app.fetch(new Request("http://localhost/health"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
`

const README = `# my-hyper-app

A Hyper app. The framework source lives under \`src/hyper/<component>/\` —
managed by the \`hyper\` CLI.

## Develop

\`\`\`bash
bun install
bun run dev
\`\`\`

## Manage components

\`\`\`bash
hyper list                 # browse the registry
hyper add cors             # add a component
hyper diff log             # inspect drift on an installed component
hyper update               # pull the latest registry versions
\`\`\`
`

export const TEMPLATES: Record<string, Template> = {
  minimal: {
    name: "minimal",
    files: {
      "src/app.ts": MINIMAL_APP,
      "tsconfig.json": MINIMAL_TSCONFIG,
      "package.json": MINIMAL_PKG,
      "test/app.test.ts": HEALTH_TEST,
      "README.md": README,
    },
    components: ["core"],
  },
  api: {
    name: "api",
    files: {
      "src/app.ts": API_APP,
      "tsconfig.json": MINIMAL_TSCONFIG,
      "package.json": MINIMAL_PKG,
      "test/app.test.ts": HEALTH_TEST,
      "README.md": README,
    },
    components: ["core", "log"],
  },
}
