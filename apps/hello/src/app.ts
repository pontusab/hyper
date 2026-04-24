import { Hyper, ok } from "@hyper/core"

export default new Hyper()
  .get("/health", () => ({ ok: true, at: new Date().toISOString() }))
  .get("/hello/:name", ({ params }) =>
    ok({ message: `Hello, ${(params as { name: string }).name}!` }),
  )
  .listen(Number(process.env.PORT ?? 3000))
