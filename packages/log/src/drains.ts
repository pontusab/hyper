/**
 * Built-in drains.
 *
 * - `stdoutDrain()` — NDJSON to stdout (zero-dep, default).
 * - `memoryDrain()` — collects events for tests.
 * - `fileDrain(path)` — appends NDJSON lines to a file via Bun.file.
 * - `axiomDrain({ dataset, token })` — batched HTTP POST to Axiom.
 *
 * Drains are fire-and-forget. Errors are swallowed by the builder.
 */

import type { LogDrain, LogEvent } from "./types.ts"

export function stdoutDrain(): LogDrain {
  const encoder = new TextEncoder()
  return {
    name: "stdout",
    write(event) {
      const line = `${JSON.stringify(event)}\n`
      if (typeof Bun !== "undefined" && typeof Bun.write === "function") {
        Bun.write(Bun.stdout, line).catch(() => {})
      } else {
        process.stdout.write(encoder.encode(line))
      }
    },
  }
}

export function memoryDrain(): LogDrain & { readonly events: LogEvent[] } {
  const events: LogEvent[] = []
  return {
    name: "memory",
    events,
    write(event) {
      events.push(event)
    },
  }
}

export function fileDrain(path: string): LogDrain {
  return {
    name: `file:${path}`,
    async write(event) {
      if (typeof Bun === "undefined") return
      const file = Bun.file(path)
      const writer = file.writer()
      writer.write(`${JSON.stringify(event)}\n`)
      await writer.end()
    },
  }
}

export interface AxiomDrainConfig {
  readonly dataset: string
  readonly token: string
  readonly endpoint?: string
  readonly batchSize?: number
  readonly flushIntervalMs?: number
}

export function axiomDrain(cfg: AxiomDrainConfig): LogDrain {
  const endpoint = cfg.endpoint ?? `https://api.axiom.co/v1/datasets/${cfg.dataset}/ingest`
  const batchSize = cfg.batchSize ?? 100
  const flushMs = cfg.flushIntervalMs ?? 1000
  let buf: LogEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async (): Promise<void> => {
    if (buf.length === 0) return
    const batch = buf
    buf = []
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-ndjson",
          authorization: `Bearer ${cfg.token}`,
        },
        body: batch.map((e) => JSON.stringify(e)).join("\n"),
      })
    } catch {
      // Drop on network error; logs are best-effort.
    }
  }

  return {
    name: `axiom:${cfg.dataset}`,
    write(event) {
      buf.push(event)
      if (buf.length >= batchSize) {
        flush()
        return
      }
      if (!timer) timer = setTimeout(flush, flushMs)
    },
    flush,
    close: flush,
  }
}
