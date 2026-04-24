/**
 * Compile-time assertions via expect-type. Run with tsgo typecheck.
 * These files are excluded from runtime tests and only sanity-check
 * that schema → ctx inference flows.
 */
import { expectTypeOf } from "expect-type"
import { route } from "../index.ts"
import type { StandardSchemaV1 } from "../standard-schema.ts"

type Obj<T> = StandardSchemaV1<unknown, T>

const bodySchema: Obj<{ email: string }> = null as unknown as Obj<{ email: string }>

const r = route
  .post("/users")
  .body(bodySchema)
  .handle(({ body }) => {
    expectTypeOf(body).toEqualTypeOf<{ email: string }>()
    return { id: 1 }
  })

expectTypeOf(r.method).toEqualTypeOf<"POST">()
expectTypeOf(r.path).toEqualTypeOf<string>()

// params flow
const paramSchema: Obj<{ id: string }> = null as unknown as Obj<{ id: string }>
const g = route
  .get("/users/:id")
  .params(paramSchema)
  .handle(({ params }) => {
    expectTypeOf(params).toEqualTypeOf<{ id: string }>()
    return { id: params.id }
  })

expectTypeOf(g.method).toEqualTypeOf<"GET">()
