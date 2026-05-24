/**
 * Local dev server. The Hyper app handles every route directly — there are
 * no static files to serve in this app.
 */

import app from "./app.ts"

const port = Number(process.env.PORT ?? 3000)
const server = Bun.serve({
  port,
  fetch(req) {
    return app.fetch(req)
  },
})

console.log(`hyperjs.ai (dev) → http://localhost:${server.port}`)
process.on("SIGTERM", () => server.stop(false))
process.on("SIGINT", () => server.stop(false))
