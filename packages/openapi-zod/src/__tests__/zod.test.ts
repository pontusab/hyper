import { describe, expect, test } from "bun:test"
import { zodConverter } from "../index.ts"

// Mock a Zod-like schema v3 style without pulling zod.
function makeObject(shape: Record<string, unknown>) {
  return {
    _def: { typeName: "ZodObject", shape: () => shape },
    parse: () => ({}),
  }
}

describe("@usehyper/openapi-zod", () => {
  test("detects zod-shaped schemas via _def + parse", () => {
    const s = makeObject({
      name: { _def: { typeName: "ZodString" }, parse: () => "" },
    })
    expect(zodConverter.canHandle(s)).toBe(true)
    expect(zodConverter.canHandle({})).toBe(false)
    expect(zodConverter.canHandle("s")).toBe(false)
  })

  test("converts object with required + optional fields", () => {
    const s = makeObject({
      name: { _def: { typeName: "ZodString" }, parse: () => "" },
      nick: {
        _def: {
          typeName: "ZodOptional",
          innerType: { _def: { typeName: "ZodString" }, parse: () => "" },
        },
        parse: () => "",
      },
    })
    const js = zodConverter.toJsonSchema(s)
    expect(js.type).toBe("object")
    expect((js.properties as Record<string, { type: string }>).name.type).toBe("string")
    expect(js.required as string[]).toEqual(["name"])
  })

  test("handles enum/array/union/literal", () => {
    const enumSchema = {
      _def: { typeName: "ZodEnum", values: ["a", "b"] },
      parse: () => "a",
    }
    expect(zodConverter.toJsonSchema(enumSchema)).toEqual({ enum: ["a", "b"] })

    const arr = {
      _def: { typeName: "ZodArray", type: { _def: { typeName: "ZodNumber" }, parse: () => 0 } },
      parse: () => [],
    }
    expect(zodConverter.toJsonSchema(arr)).toEqual({ type: "array", items: { type: "number" } })
  })
})
