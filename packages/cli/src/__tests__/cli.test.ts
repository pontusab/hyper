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
  test("minimal + api templates are well-formed", () => {
    expect(TEMPLATES.minimal).toBeDefined()
    expect(TEMPLATES.minimal!.files["src/app.ts"]).toContain("@hyper/core")
    expect(TEMPLATES.api).toBeDefined()
    expect(TEMPLATES.api!.files["src/app.ts"]).toContain("@hyper/log")
  })
})
