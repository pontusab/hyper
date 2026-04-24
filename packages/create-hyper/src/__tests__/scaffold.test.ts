import { describe, expect, test } from "bun:test"
import { TEMPLATES, scaffold } from "../scaffold.ts"

describe("create-hyper scaffold", () => {
  test("minimal template contains a Hyper app entry", () => {
    const files = scaffold({ dir: "/tmp", name: "demo", template: "minimal" })
    const app = files.find((f) => f.path === "src/app.ts")
    expect(app).toBeDefined()
    expect(app?.contents).toContain('import { Hyper, ok } from "@hyper/core"')
    expect(app?.contents).toContain("new Hyper()")
    expect(app?.contents).toContain(".listen(")
  })

  test("minimal template no longer emits a separate adapter file", () => {
    const files = scaffold({ dir: "/tmp", name: "demo", template: "minimal" })
    expect(files.find((f) => f.path === "src/adapter.ts")).toBeUndefined()
  })

  test("todo template includes the todo app", () => {
    const files = scaffold({ dir: "/tmp", name: "demo", template: "todo" })
    const app = files.find((f) => f.path === "src/app.ts")
    expect(app?.contents).toContain("/todos")
  })

  test("all templates produce package.json with hyper scripts", () => {
    for (const t of TEMPLATES) {
      const files = scaffold({ dir: "/tmp", name: "demo", template: t })
      const pkg = files.find((f) => f.path === "package.json")
      expect(pkg?.contents).toContain('"dev": "hyper dev"')
    }
  })
})
