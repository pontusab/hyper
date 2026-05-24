/**
 * Compile-time assertions via expect-type. Run with tsgo typecheck.
 * These files are excluded from runtime tests and only sanity-check
 * that schema → ctx inference flows.
 */
import { expectTypeOf } from "expect-type"
import type { PathParams } from "../hyper.ts"
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

// PathParams<P> mirrors the runtime grammar.
expectTypeOf<PathParams<"/users">>().toEqualTypeOf<Record<string, never>>()
expectTypeOf<PathParams<"/users/:id">>().toEqualTypeOf<{ id: string }>()
expectTypeOf<PathParams<"/users/:id/posts/:postId">>().toEqualTypeOf<{
  id: string
  postId: string
}>()
// Mixed segments: literal chars end the param name.
expectTypeOf<PathParams<"/r/:slug.json">>().toEqualTypeOf<{ slug: string }>()
expectTypeOf<PathParams<"/r/:name@:version.json">>().toEqualTypeOf<{
  name: string
  version: string
}>()
expectTypeOf<PathParams<"/v:version/users">>().toEqualTypeOf<{ version: string }>()
expectTypeOf<PathParams<"/posts/:y-:m-:d">>().toEqualTypeOf<{
  y: string
  m: string
  d: string
}>()

// Mixed segments flow through the Hyper verb-shortcut handler ctx too.
import { Hyper } from "../hyper.ts"
const _verbCheck = new Hyper().get("/r/:name@:version.json", ({ params }) => {
  expectTypeOf(params).toEqualTypeOf<{ name: string; version: string }>()
  return { name: params.name, version: params.version }
})
void _verbCheck
