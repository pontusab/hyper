import { describe, expect, test } from "bun:test"
import { app, route } from "@hyper/core"
import { SloRecorder, otel } from "../index.ts"

describe("@hyper/otel", () => {
  test("records duration samples to the SLO recorder", async () => {
    const rec = new SloRecorder()
    const r = route
      .get("/slow")
      .use(otel({ recorder: rec }))
      .handle(async () => {
        await new Promise((res) => setTimeout(res, 5))
        return "ok"
      })
    const a = app({ routes: [r] })
    for (let i = 0; i < 3; i++) await a.fetch(new Request("http://local/slow"))
    const snap = rec.snapshot()
    expect(snap["/slow"]?.count).toBe(3)
    expect(snap["/slow"]?.p99).toBeGreaterThan(0)
  })

  test("creates spans when a tracer is provided", async () => {
    const ended: { name: string; status?: number }[] = []
    const tracer = {
      startSpan(name: string) {
        const span = {
          setAttribute() {},
          setStatus(s: { code: number }) {
            span.status = s.code
          },
          end() {
            ended.push({ name, status: span.status })
          },
          status: 0,
        }
        return span
      },
    }
    const r = route
      .get("/t")
      .use(otel({ tracer }))
      .handle(() => "ok")
    const a = app({ routes: [r] })
    await a.fetch(new Request("http://local/t"))
    expect(ended[0]?.name).toBe("GET /t")
    expect(ended[0]?.status).toBe(1)
  })
})
