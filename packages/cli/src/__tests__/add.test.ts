import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAdd } from "../commands/add.ts"
import { runDiff } from "../commands/diff.ts"
import { writeConfig } from "../config/index.ts"
import { SNAPSHOT_INDEX, createRegistryClient } from "../registry/index.ts"

async function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd()
  process.chdir(dir)
  try {
    return await fn()
  } finally {
    process.chdir(prev)
  }
}

async function setupProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "hyper-add-"))
  await writeConfig(
    {
      registryUrl: "https://example.invalid",
      baseDir: "src/hyper",
      alias: "@hyper",
    },
    dir,
  )
  return dir
}

describe("registry client (snapshot fallback)", () => {
  test("snapshot index includes core + a representative set of components", () => {
    const names = SNAPSHOT_INDEX.components.map((c) => c.name)
    expect(names).toContain("core")
    expect(names).toContain("cors")
    expect(names).toContain("auth-jwt")
    expect(names).toContain("agent-rules")
  })

  test("offline client serves the snapshot index", async () => {
    const c = createRegistryClient({ url: "https://example.invalid", offline: true })
    const idx = await c.getIndex()
    expect(idx.components.length).toBeGreaterThan(0)
    const cors = await c.getComponent("cors")
    expect(cors.name).toBe("cors")
    expect(cors.registryDeps).toContain("core")
  })
})

describe("hyper add", () => {
  test("copies cors + transitive core deps into the project", async () => {
    const dir = await setupProject()
    await withCwd(dir, async () => {
      // Force snapshot mode by pointing at an unreachable URL.
      const code = await runAdd({
        command: "add",
        positional: ["cors"],
        flags: {},
      })
      expect(code).toBe(0)
      const corsBody = await readFile(join(dir, "src/hyper/cors/index.ts"), "utf8")
      expect(corsBody).toContain("@hyper/core")
      const coreIndex = await readFile(join(dir, "src/hyper/core/index.ts"), "utf8")
      expect(coreIndex).toContain("export")
    })
  })

  test("refuses to overwrite drifted files without --force", async () => {
    const dir = await setupProject()
    await withCwd(dir, async () => {
      await runAdd({ command: "add", positional: ["cors"], flags: {} })
      await writeFile(join(dir, "src/hyper/cors/index.ts"), "// drifted\n")
      const code = await runAdd({ command: "add", positional: ["cors"], flags: {} })
      expect(code).toBe(1)
    })
  })

  test("--force overrides drift protection", async () => {
    const dir = await setupProject()
    await withCwd(dir, async () => {
      await runAdd({ command: "add", positional: ["cors"], flags: {} })
      await writeFile(join(dir, "src/hyper/cors/index.ts"), "// drifted\n")
      const code = await runAdd({
        command: "add",
        positional: ["cors"],
        flags: { force: true },
      })
      expect(code).toBe(0)
      const after = await readFile(join(dir, "src/hyper/cors/index.ts"), "utf8")
      expect(after).not.toBe("// drifted\n")
    })
  })

  test("agent-rules drops .cursor/rules + AGENTS.md at project root, NOT under baseDir", async () => {
    const dir = await setupProject()
    await withCwd(dir, async () => {
      const code = await runAdd({
        command: "add",
        positional: ["agent-rules"],
        flags: {},
      })
      expect(code).toBe(0)
      const rules = await readFile(join(dir, ".cursor/rules/hyper.md"), "utf8")
      expect(rules).toContain("Hyper rules")
      const agents = await readFile(join(dir, "AGENTS.md"), "utf8")
      expect(agents).toContain("AGENTS.md")
    })
  })
})

describe("hyper diff", () => {
  test("detects drift against the registry", async () => {
    const dir = await setupProject()
    await withCwd(dir, async () => {
      await runAdd({ command: "add", positional: ["cors"], flags: {} })
      const clean = await runDiff({ command: "diff", positional: ["cors"], flags: {} })
      expect(clean).toBe(0)
      await writeFile(join(dir, "src/hyper/cors/index.ts"), "// drifted\n")
      const drift = await runDiff({ command: "diff", positional: ["cors"], flags: {} })
      expect(drift).toBe(1)
    })
  })
})
