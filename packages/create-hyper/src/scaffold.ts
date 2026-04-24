/**
 * Pure scaffolding logic — accepts a target dir and a template name,
 * returns the set of files to write. Keeping it pure so we can test
 * without touching disk.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export type TemplateName = "minimal" | "todo" | "ai"

export interface ScaffoldOptions {
  readonly dir: string
  readonly name: string
  readonly template: TemplateName
  readonly packageManager?: "bun" | "npm" | "pnpm"
}

export interface ScaffoldFile {
  readonly path: string
  readonly contents: string
}

export const TEMPLATES: readonly TemplateName[] = ["minimal", "todo", "ai"]

export function scaffold(opts: ScaffoldOptions): readonly ScaffoldFile[] {
  switch (opts.template) {
    case "minimal":
      return minimalTemplate(opts)
    case "todo":
      return todoTemplate(opts)
    case "ai":
      return aiTemplate(opts)
  }
}

export async function writeScaffold(opts: ScaffoldOptions): Promise<void> {
  const files = scaffold(opts)
  for (const f of files) {
    const abs = resolve(opts.dir, f.path)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, f.contents)
  }
}

const pkg = (name: string, extra: Record<string, string> = {}) =>
  `${JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: {
        dev: "hyper dev",
        build: "hyper build",
        start: "bun dist/app.js",
        test: "hyper test",
        typecheck: "tsgo --noEmit",
      },
      dependencies: {
        "@hyper/core": "^0.0.0",
        "@hyper/log": "^0.0.0",
        ...extra,
      },
      devDependencies: {
        "@hyper/cli": "^0.0.0",
        "@types/bun": "^1.3.1",
      },
    },
    null,
    2,
  )}\n`

const baseTsconfig = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "types": ["bun"],
    "lib": ["ESNext"]
  },
  "include": ["src"]
}
`

const gitignore = "node_modules\ndist\n.env\n.hyper\n"
const envExample = "PORT=3000\n"

function minimalTemplate(opts: ScaffoldOptions): readonly ScaffoldFile[] {
  const app = `/**
 * Minimal Hyper app.
 */

import { Hyper, ok } from "@hyper/core"

export default new Hyper()
  .get("/", () => ok({ hello: "world" }))
  .listen(Number(process.env.PORT ?? 3000))
`
  return [
    { path: "package.json", contents: pkg(opts.name) },
    { path: "tsconfig.json", contents: baseTsconfig },
    { path: ".gitignore", contents: gitignore },
    { path: ".env.example", contents: envExample },
    { path: "src/app.ts", contents: app },
    {
      path: "README.md",
      contents: `# ${opts.name}\n\nScaffolded with \`create-hyper\`.\n\nRun \`bun dev\` to start the dev server.\n`,
    },
  ]
}

function todoTemplate(opts: ScaffoldOptions): readonly ScaffoldFile[] {
  const files = [...minimalTemplate(opts)]
  const todo = `import { Hyper, conflict, notFound, ok } from "@hyper/core"

interface Todo { id: string; title: string; done: boolean }
const store = new Map<string, Todo>()

export default new Hyper({ prefix: "/todos" })
  .get("/", () => ok([...store.values()]))
  .post(
    "/",
    {
      body: {
        "~standard": {
          version: 1,
          vendor: "inline",
          validate: (v: unknown) => ({ value: v as { id: string; title: string } }),
        },
      },
    },
    ({ body }) => {
      const b = body as { id: string; title: string }
      if (store.has(b.id)) return conflict({ id: b.id })
      const t: Todo = { id: b.id, title: b.title, done: false }
      store.set(t.id, t)
      return ok(t)
    },
  )
  .get("/:id", ({ params }) => {
    const id = String((params as { id: string }).id)
    const t = store.get(id)
    return t ? ok(t) : notFound({ id })
  })
  .listen(Number(process.env.PORT ?? 3000))
`
  return files.filter((f) => f.path !== "src/app.ts").concat({ path: "src/app.ts", contents: todo })
}

function aiTemplate(opts: ScaffoldOptions): readonly ScaffoldFile[] {
  const files = [...minimalTemplate(opts)]
  const ai = `import { Hyper, ok } from "@hyper/core"

export default new Hyper()
  .post(
    "/chat",
    { meta: { name: "ai.chat", mcp: { expose: true, description: "Echo chat tool." } } },
    ({ req }) => ok({ echoed: req.method }),
  )
  .listen(Number(process.env.PORT ?? 3000))
`
  return files.filter((f) => f.path !== "src/app.ts").concat({ path: "src/app.ts", contents: ai })
}
