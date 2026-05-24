import { describe, expect, test } from "bun:test"
import { parseArgs } from "../args.ts"
import { TEMPLATES } from "../templates.ts"

describe("cli args parser", () => {
  test("parses command + positional + flags", () => {
    const a = parseArgs(["build", "src/app.ts", "--out", "dist", "--minify"])
    expect(a.command).toBe("build")
    expect(a.positional).toEqual(["src/app.ts"])
    expect(a.flags.out).toBe("dist")
    expect(a.flags.minify).toBe(true)
  })

  test("respects --json", () => {
    const a = parseArgs(["routes", "--json"])
    expect(a.flags.json).toBe(true)
  })

  test("no command returns undefined", () => {
    const a = parseArgs([])
    expect(a.command).toBeUndefined()
  })
})

describe("cli templates", () => {
  test("templates ship with @hyper/* (not @usehyper/*) imports", () => {
    expect(TEMPLATES.minimal).toBeDefined()
    expect(TEMPLATES.minimal!.files["src/app.ts"]).toContain("@hyper/core")
    expect(TEMPLATES.minimal!.files["src/app.ts"]).not.toContain("@usehyper/core")
    expect(TEMPLATES.api).toBeDefined()
    expect(TEMPLATES.api!.files["src/app.ts"]).toContain("@hyper/log")
    expect(TEMPLATES.api!.files["src/app.ts"]).not.toContain("@usehyper/log")
  })

  test("templates patch tsconfig with @hyper/* path mapping", () => {
    expect(TEMPLATES.minimal!.files["tsconfig.json"]).toContain('"@hyper/*"')
    expect(TEMPLATES.minimal!.files["tsconfig.json"]).toContain("./src/hyper/*")
  })

  test("templates have no @usehyper/* runtime deps", () => {
    expect(TEMPLATES.minimal!.files["package.json"]).not.toContain("@usehyper/")
    expect(TEMPLATES.api!.files["package.json"]).not.toContain("@usehyper/")
  })

  test("templates declare which components to install after init", () => {
    expect(TEMPLATES.minimal!.components).toContain("core")
    expect(TEMPLATES.api!.components).toContain("core")
    expect(TEMPLATES.api!.components).toContain("log")
  })
})
