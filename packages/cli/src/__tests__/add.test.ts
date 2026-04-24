import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAdd } from "../commands/add.ts"
import { runDiff } from "../commands/diff.ts"
import { buildLocalRegistry } from "../registry/local.ts"

async function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd()
  process.chdir(dir)
  try {
    return await fn()
  } finally {
    process.chdir(prev)
  }
}

describe("hyper add", () => {
  test("local registry exposes the bun adapter + core components", async () => {
    const r = await buildLocalRegistry()
    expect(r.map((c) => c.name)).toContain("adapter-bun")
    expect(r.map((c) => c.name)).toContain("cors")
    expect(r.map((c) => c.name)).toContain("auth")
  })

  test("copies files into the target repo (content-hash verified)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hyper-add-"))
    await withCwd(dir, async () => {
      const code = await runAdd({
        command: "add",
        positional: ["adapter-bun"],
        flags: {},
      })
      expect(code).toBe(0)
      const body = await readFile(join(dir, "src/adapters/bun.ts"), "utf8")
      expect(body).toContain("Bun.serve")
    })
  })

  test("refuses to overwrite drifted files without --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hyper-add-"))
    await withCwd(dir, async () => {
      await runAdd({ command: "add", positional: ["adapter-bun"], flags: {} })
      await writeFile(join(dir, "src/adapters/bun.ts"), "// drifted\n")
      const code = await runAdd({
        command: "add",
        positional: ["adapter-bun"],
        flags: {},
      })
      expect(code).toBe(1)
    })
  })
})

describe("hyper diff", () => {
  test("detects drift against the registry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hyper-diff-"))
    await withCwd(dir, async () => {
      await runAdd({ command: "add", positional: ["adapter-bun"], flags: {} })
      const clean = await runDiff({ command: "diff", positional: ["adapter-bun"], flags: {} })
      expect(clean).toBe(0)
      await writeFile(join(dir, "src/adapters/bun.ts"), "// drifted\n")
      const drift = await runDiff({ command: "diff", positional: ["adapter-bun"], flags: {} })
      expect(drift).toBe(1)
    })
  })
})
