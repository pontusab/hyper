/**
 * Type utilities for downstream consumers.
 *
 * These let `@usehyper/client` and user code derive input/output/context
 * types from a router tree without reflection.
 *
 * Usage:
 *   import { type InferRouterInputs } from "@usehyper/core"
 *   type Inputs = InferRouterInputs<typeof router>
 *   type CreateUser = Inputs["users"]["create"]
 */

import type { CallableRoute } from "./route.ts"
import type { AppContext, Route } from "./types.ts"

/** Anything that looks like a plain-object router branch. */
export type RouterLike = { [key: string]: Route | RouterLike }

/** Extract inputs from a router tree, preserving namespace structure. */
export type InferRouterInputs<R> = {
  [K in keyof R]: R[K] extends CallableRoute<infer _M, infer P, infer Q, infer B, infer H, infer _O>
    ? { params: P; query: Q; body: B; headers: H }
    : R[K] extends Route
      ? unknown
      : R[K] extends RouterLike
        ? InferRouterInputs<R[K]>
        : never
}

/** Extract outputs — the handler's resolved return type. */
export type InferRouterOutputs<R> = {
  [K in keyof R]: R[K] extends CallableRoute<
    infer _M,
    infer _P,
    infer _Q,
    infer _B,
    infer _H,
    infer O
  >
    ? Awaited<O>
    : R[K] extends Route
      ? unknown
      : R[K] extends RouterLike
        ? InferRouterOutputs<R[K]>
        : never
}

/** The shared context type used by every route in the tree. */
export type InferRouterCtx<_R> = AppContext
