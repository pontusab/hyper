import { describe, expect, test } from "bun:test"
import { VERSION } from "../index.ts"

describe("create-hyper", () => {
  test("ships a version constant (used as a smoke test for the shim)", () => {
    expect(typeof VERSION).toBe("string")
    expect(VERSION.length).toBeGreaterThan(0)
  })
})
