import a from "./app.ts"

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: a.routes,
  fetch: a.fetch,
})

process.on("SIGTERM", () => server.stop(false))
process.on("SIGINT", () => server.stop(false))

console.log(`todo example listening on http://localhost:${server.port}`)
