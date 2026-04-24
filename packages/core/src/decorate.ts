/**
 * Context decoration — three-tier dependency injection.
 *
 * 1. `decorate(env => ({ db, redis }))` at app / group / route level
 *    — static singletons constructed once at boot. Disposed in reverse
 *    order on shutdown via `Symbol.asyncDispose`.
 * 2. `derive(fn)` — runs per-request; computes values from ctx/req
 *    (e.g., `ctx.user` from a JWT claim).
 * 3. Plugin-installed context via `plugin.context`.
 *
 * Types flow via `declare module "@usehyper/core" { interface AppContext { ... } }`.
 *
 * Recipe (cross-file typing):
 *   // src/ctx.d.ts
 *   import type { Db } from "./db"
 *   declare module "@usehyper/core" { interface AppContext { db: Db } }
 */

import type { AppContext } from "./types.ts"

export type DecorateFactory<Env = unknown, Added = unknown> = (env: Env) => Added | Promise<Added>

export type DeriveFactory<
  Env = unknown,
  CtxIn extends AppContext = AppContext,
  Added = unknown,
> = (args: { ctx: CtxIn; env: Env; req: Request }) => Added | Promise<Added>

/** Registry built at app() time; applied to each request's ctx. */
export interface ContextBlueprint<Env = unknown> {
  readonly decorators: readonly DecorateFactory<Env>[]
  readonly derives: readonly DeriveFactory<Env>[]
}

/**
 * Resolve all `decorate()` entries once at boot. Returns the merged
 * static context plus a disposer (async) that runs in reverse order.
 */
export async function resolveStaticContext<Env>(
  bp: ContextBlueprint<Env>,
  env: Env,
): Promise<{ ctx: Record<string, unknown>; dispose: () => Promise<void> }> {
  const merged: Record<string, unknown> = {}
  const disposers: Array<() => Promise<void>> = []
  for (const f of bp.decorators) {
    const added = await f(env)
    if (added && typeof added === "object") {
      for (const [k, v] of Object.entries(added as Record<string, unknown>)) {
        merged[k] = v
        if (isAsyncDisposable(v)) {
          disposers.push(async () => {
            await (v as { [Symbol.asyncDispose]: () => PromiseLike<void> })[Symbol.asyncDispose]()
          })
        } else if (isDisposable(v)) {
          disposers.push(async () => {
            ;(v as { [Symbol.dispose]: () => void })[Symbol.dispose]()
          })
        }
      }
    }
  }
  return {
    ctx: merged,
    async dispose() {
      for (let i = disposers.length - 1; i >= 0; i--) {
        try {
          await disposers[i]?.()
        } catch (err) {
          console.error("hyper: disposer failed:", err)
        }
      }
    },
  }
}

/**
 * Apply per-request `derive()` to an already-static-decorated ctx.
 *
 * Fast path: when there are zero derive functions we return the static
 * ctx as-is — avoiding a per-request shallow clone. Plugins/consumers
 * must treat the ctx as read-only (which the `AppContext` type already
 * implies via declaration-merged readonly surfaces).
 */
export async function applyDerive<Env>(
  bp: ContextBlueprint<Env>,
  staticCtx: Record<string, unknown>,
  env: Env,
  req: Request,
): Promise<Record<string, unknown>> {
  if (bp.derives.length === 0) return staticCtx
  const ctx = { ...staticCtx }
  for (const f of bp.derives) {
    const added = await f({ ctx: ctx as AppContext, env, req })
    if (added && typeof added === "object") Object.assign(ctx, added)
  }
  return ctx
}

function isAsyncDisposable(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<PropertyKey, unknown>)[Symbol.asyncDispose] === "function"
  )
}

function isDisposable(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<PropertyKey, unknown>)[Symbol.dispose] === "function"
  )
}
