/**
 * Rolling in-memory recorder for recent requests + errors.
 *
 * Used by the dev MCP tools (recent_requests, recent_errors, replay_request).
 * Bounded by a max size so memory stays flat across long dev sessions.
 */

export interface RecordedRequest {
  readonly id: string
  readonly method: string
  readonly path: string
  readonly status: number
  readonly durationMs: number
  readonly startedAt: number
  readonly route?: string
  readonly headers: Record<string, string>
  readonly query: Record<string, string>
  readonly body?: string
}

export interface RecordedError {
  readonly id: string
  readonly method: string
  readonly path: string
  readonly at: number
  readonly message: string
  readonly stack?: string
  readonly route?: string
}

const MAX = 200

export class DevRecorder {
  #requests: RecordedRequest[] = []
  #errors: RecordedError[] = []

  push(r: RecordedRequest): void {
    this.#requests.push(r)
    if (this.#requests.length > MAX) this.#requests.shift()
  }
  pushError(e: RecordedError): void {
    this.#errors.push(e)
    if (this.#errors.length > MAX) this.#errors.shift()
  }
  requests(limit = 50): readonly RecordedRequest[] {
    return this.#requests.slice(-limit).reverse()
  }
  errors(limit = 50): readonly RecordedError[] {
    return this.#errors.slice(-limit).reverse()
  }
  find(id: string): RecordedRequest | undefined {
    return this.#requests.find((r) => r.id === id)
  }
  clear(): void {
    this.#requests.length = 0
    this.#errors.length = 0
  }
}
