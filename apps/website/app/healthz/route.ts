/**
 * `GET /healthz` — liveness probe. Returns 200 with a tiny JSON body.
 */

export function GET(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
