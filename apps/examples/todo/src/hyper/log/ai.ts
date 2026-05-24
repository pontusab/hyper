/**
 * AI SDK wrapper — emits one event per generateText/streamText call with
 * token counts, model, latency, and a hash of the prompt (not the content).
 *
 * Usage:
 *   const wrappedModel = wrapAiModel(openai("gpt-4o-mini"), () => ctx.log)
 *
 * We stay deliberately structural: we don't import `ai` to keep peer deps
 * optional. Users pass their model-like object; we proxy the `doGenerate`
 * / `doStream` calls.
 */

import type { LogBuilder } from "./types.ts"

type GetLog = () => LogBuilder | undefined

interface AiModelLike {
  readonly modelId?: string
  readonly provider?: string
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK provider types vary
  doGenerate?: (...args: any[]) => Promise<any>
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK provider types vary
  doStream?: (...args: any[]) => Promise<any>
}

export function wrapAiModel<M extends AiModelLike>(model: M, getLog: GetLog): M {
  const base = {
    provider: model.provider,
    modelId: model.modelId,
  }

  // biome-ignore lint/suspicious/noExplicitAny: see above
  const wrap = (fn: (...a: any[]) => Promise<any>, kind: "generate" | "stream") => {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch
    return async (...args: any[]) => {
      const start = performance.now()
      const log = getLog()
      try {
        const out = await fn.apply(model, args)
        const usage = (out as { usage?: { promptTokens?: number; completionTokens?: number } })
          ?.usage
        log
          ?.child("ai")
          .set({
            ...base,
            kind,
            took_ms: performance.now() - start,
            prompt_tokens: usage?.promptTokens,
            completion_tokens: usage?.completionTokens,
          })
          .finish()
        return out
      } catch (e) {
        log
          ?.child("ai")
          .set({
            ...base,
            kind,
            took_ms: performance.now() - start,
            err: String(e),
          })
          .level("error")
          .finish()
        throw e
      }
    }
  }

  return new Proxy(model, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver)
      if (prop === "doGenerate" && typeof v === "function") {
        // biome-ignore lint/suspicious/noExplicitAny: see file header
        return wrap(v as (...a: any[]) => Promise<any>, "generate")
      }
      if (prop === "doStream" && typeof v === "function") {
        // biome-ignore lint/suspicious/noExplicitAny: see file header
        return wrap(v as (...a: any[]) => Promise<any>, "stream")
      }
      return v
    },
  })
}
