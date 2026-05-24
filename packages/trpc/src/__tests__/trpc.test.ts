import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { trpcHandler, trpcToHyper } from "../index.ts"

// A fake router matching the structural shape tRPC exposes.
function fakeRouter() {
  type Proc = ((args: { input: unknown; ctx: unknown }) => Promise<unknown>) & {
    _def: { type: string }
  }
  const hello = Object.assign(
    async ({ input }: { input: { name: string } }) => ({ greeting: `hi ${input.name}` }),
    { _def: { type: "query" } },
  ) as unknown as Proc
  const bump = Object.assign(
    async ({ input }: { input: { n: number } }) => ({ out: input.n + 1 }),
    { _def: { type: "mutation" } },
  ) as unknown as Proc
  return { _def: { procedures: { hello, bump } } }
}

describe("trpcToHyper", () => {
  test("emits one route per procedure", () => {
    const router = fakeRouter()
    const routes = trpcToHyper(router)
    expect(routes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      "POST /trpc/bump",
      "POST /trpc/hello",
    ])
  })

  test("round-trips an input via the Hyper route", async () => {
    const router = fakeRouter()
    const routes = trpcToHyper(router, { prefix: "/trpc" })
    const a = app({ routes })
    const res = await a.invoke({
      method: "POST",
      path: "/trpc/hello",
      body: { input: { name: "Ada" } },
    })
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ result: { data: { greeting: "hi Ada" } } })
  })
})

describe("trpcHandler (route-mounted)", () => {
  test("forwards to the correct procedure", async () => {
    const router = fakeRouter()
    const handler = trpcHandler(router)
    const r = route.post("/trpc/:proc").handle(async (c) =>
      handler({
        req: c.req,
        params: { proc: c.params.proc },
        ctx: c.ctx,
        body: c.body,
      }),
    )
    const a = app({ routes: [r] })
    const res = await a.invoke({
      method: "POST",
      path: "/trpc/:proc",
      params: { proc: "bump" },
      body: { input: { n: 41 } },
    })
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ result: { data: { out: 42 } } })
  })

  test("returns NOT_FOUND for unknown proc", async () => {
    const router = fakeRouter()
    const handler = trpcHandler(router)
    const r = route.post("/trpc/:proc").handle(async (c) =>
      handler({
        req: c.req,
        params: { proc: c.params.proc },
        ctx: c.ctx,
        body: c.body,
      }),
    )
    const a = app({ routes: [r] })
    const res = await a.invoke({
      method: "POST",
      path: "/trpc/:proc",
      params: { proc: "nope" },
      body: { input: {} },
    })
    expect(res.status).toBe(404)
  })
})

describe(".actionable() marker", () => {
  test("sets meta.action = true", () => {
    const r = route
      .post("/submit")
      .actionable()
      .handle(() => ({ ok: true }))
    const a = app({ routes: [r] })
    expect(a.routeList[0]!.meta.action).toBe(true)
  })
})
