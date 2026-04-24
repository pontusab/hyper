/**
 * SSE subscribe helper.
 *
 *   for await (const event of subscribe("/events", { baseUrl })) { ... }
 */

export interface SubscribeOptions {
  readonly baseUrl?: string
  readonly headers?: Record<string, string>
  readonly signal?: AbortSignal
  readonly fetch?: typeof fetch
}

export async function* subscribe(
  path: string,
  opts: SubscribeOptions = {},
): AsyncGenerator<{ type: string; data: string; id?: string }> {
  const url = opts.baseUrl
    ? `${opts.baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`
    : path
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis)
  const res = await fetchImpl(url, {
    headers: { accept: "text/event-stream", ...opts.headers },
    ...(opts.signal ? { signal: opts.signal } : {}),
  })
  if (!res.body) throw new Error("sse: empty response body")

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buf = ""
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx = buf.indexOf("\n\n")
      while (idx >= 0) {
        const raw = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        yield parseSseEvent(raw)
        idx = buf.indexOf("\n\n")
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSseEvent(raw: string): { type: string; data: string; id?: string } {
  let type = "message"
  const dataLines: string[] = []
  let id: string | undefined
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue
    const colon = line.indexOf(":")
    const k = colon < 0 ? line : line.slice(0, colon)
    const v = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "")
    if (k === "event") type = v
    else if (k === "data") dataLines.push(v)
    else if (k === "id") id = v
  }
  return { type, data: dataLines.join("\n"), ...(id !== undefined && { id }) }
}
