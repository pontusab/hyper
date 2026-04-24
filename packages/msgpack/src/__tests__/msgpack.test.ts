import { describe, expect, test } from "bun:test"
import { decode, encode } from "../codec.ts"

describe("@usehyper/msgpack codec", () => {
  test("roundtrips primitives", () => {
    for (const v of [
      null,
      true,
      false,
      0,
      1,
      -1,
      127,
      -32,
      255,
      -128,
      12345,
      -12345,
      1_000_000,
      3.14,
    ]) {
      expect(decode(encode(v))).toEqual(v)
    }
  })

  test("roundtrips strings", () => {
    for (const s of ["", "a", "hello world", "こんにちは", "x".repeat(200)]) {
      expect(decode(encode(s))).toBe(s)
    }
  })

  test("roundtrips arrays + maps", () => {
    const value = {
      id: 42,
      name: "ada",
      tags: ["rust", "bun"],
      nested: { x: 1, y: [true, false, null] },
    }
    expect(decode(encode(value))).toEqual(value)
  })
})
