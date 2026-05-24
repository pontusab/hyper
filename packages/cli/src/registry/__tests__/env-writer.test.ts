import { describe, expect, test } from "bun:test"
import { mergeEnvFile } from "../env-writer.ts"

describe("mergeEnvFile", () => {
  test("appends new keys to empty file", () => {
    const r = mergeEnvFile("", { FOO: "bar" })
    expect(r.added).toEqual(["FOO"])
    expect(r.preserved).toEqual([])
    expect(r.merged).toContain("FOO=bar\n")
    expect(r.merged.startsWith("# Added by `hyper add`")).toBe(true)
  })

  test("preserves existing keys verbatim", () => {
    const existing = "FOO=existing-value\n"
    const r = mergeEnvFile(existing, { FOO: "new-value" })
    expect(r.added).toEqual([])
    expect(r.preserved).toEqual(["FOO"])
    expect(r.merged).toBe(existing)
  })

  test("mixed: keep existing, append missing", () => {
    const existing = "FOO=keep-me\n"
    const r = mergeEnvFile(existing, { FOO: "ignored", BAR: "added" })
    expect(r.added).toEqual(["BAR"])
    expect(r.preserved).toEqual(["FOO"])
    expect(r.merged).toContain("FOO=keep-me\n")
    expect(r.merged).toContain("BAR=added\n")
  })

  test("resolves ${random:hex:N} into 2N hex chars", () => {
    const r = mergeEnvFile("", { JWT_SECRET: "${random:hex:32}" })
    const m = /JWT_SECRET=([a-f0-9]+)/.exec(r.merged)
    expect(m).not.toBeNull()
    expect(m?.[1]?.length).toBe(64)
  })

  test("resolves ${random:base64:N}", () => {
    const r = mergeEnvFile("", { S: "${random:base64:24}" })
    const m = /S=(.+)/.exec(r.merged)
    expect(m).not.toBeNull()
    expect(m?.[1]).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  test("ignores ${...} forms it doesn't recognize", () => {
    const r = mergeEnvFile("", { X: "${env:OTHER}" })
    expect(r.merged).toContain('X="${env:OTHER}"\n')
  })

  test("respects export prefix when checking existing keys", () => {
    const r = mergeEnvFile("export FOO=1\n", { FOO: "x" })
    expect(r.preserved).toEqual(["FOO"])
    expect(r.added).toEqual([])
  })

  test("skips comments and quoted hashes when reading keys", () => {
    const existing = `# FOO=hidden
BAR="value with # hash"
`
    const r = mergeEnvFile(existing, { FOO: "added", BAR: "ignored" })
    expect(r.added).toEqual(["FOO"])
    expect(r.preserved).toEqual(["BAR"])
  })

  test("idempotent: re-running yields the same file", () => {
    const r1 = mergeEnvFile("", { A: "1", B: "2" })
    const r2 = mergeEnvFile(r1.merged, { A: "x", B: "y" })
    expect(r2.merged).toBe(r1.merged)
    expect(r2.added).toEqual([])
    expect(r2.preserved.sort()).toEqual(["A", "B"])
  })

  test("alphabetical key order in appended block", () => {
    const r = mergeEnvFile("", { ZED: "z", ALPHA: "a", MID: "m" })
    const lines = r.merged.split("\n").filter((l) => l.includes("="))
    expect(lines).toEqual(["ALPHA=a", "MID=m", "ZED=z"])
  })

  test("preserves trailing-newline normalization", () => {
    const r = mergeEnvFile("EXIST=1\n\n\n", { NEW: "v" })
    expect(r.merged).toContain("EXIST=1\n\n# Added by `hyper add`")
    expect(r.merged.endsWith("\n")).toBe(true)
  })
})
