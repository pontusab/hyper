/**
 * Test clock — a single abstraction plugins can consume instead of
 * `Date.now()`. Plugins accept `clock?: Clock` in their config; at test
 * time you pass a fake clock and call `advanceTime(ms)`.
 *
 * We deliberately do NOT monkey-patch global `Date`. Explicit clock
 * injection is the contract.
 */

export interface Clock {
  readonly now: () => number
}

export interface TestClock extends Clock {
  /** Move the clock forward by `ms`. Pending timers are not drained. */
  readonly advance: (ms: number) => void
  /** Reset the clock to `t0`. */
  readonly reset: (t0?: number) => void
}

export function testClock(t0 = 1_700_000_000_000): TestClock {
  let t = t0
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
    reset: (r = t0) => {
      t = r
    },
  }
}

export const systemClock: Clock = { now: () => Date.now() }

/** Ambient helper — tests call this to advance a shared clock. */
let ambient: TestClock | undefined
export function useTestClock(clock: TestClock): TestClock {
  ambient = clock
  return clock
}
export function advanceTime(ms: number): void {
  if (!ambient)
    throw new Error("advanceTime: no ambient test clock — call useTestClock(testClock()) first")
  ambient.advance(ms)
}
