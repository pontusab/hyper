/**
 * @hyper/testing — ergonomic primitives for testing Hyper apps.
 *
 * Philosophy: testing a Hyper route should feel like testing a plain
 * async function. No supertest, no dev-server juggling, no mock server.
 */

export { assertResponse, type Assertion } from "./assert.ts"
export { call } from "./call.ts"
export {
  captureEvents,
  type CapturedEvent,
  type EventCapture,
} from "./capture.ts"
export {
  advanceTime,
  type Clock,
  systemClock,
  testClock,
  type TestClock,
  useTestClock,
} from "./clock.ts"
export {
  type KvEntry,
  type KvStore,
  type MemoryDb,
  memoryDb,
  memoryKv,
  memoryRateLimiter,
  type MemoryRateLimiterOptions,
  type MemoryTable,
  memoryTable,
  type RateLimitResult,
} from "./memory-stores.ts"
export { mockCtx } from "./mock-ctx.ts"
export { mockPlugin } from "./mock-plugin.ts"
export { asUser, fakeRequest, type FakeRequestInit, type FakeUser } from "./request.ts"
export { type ManifestSnapshot, snapshotManifest } from "./snapshot.ts"
