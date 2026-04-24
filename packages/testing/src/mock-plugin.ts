/**
 * `mockPlugin({...})` — one-liner plugin for inserting arbitrary test
 * behavior without writing a full plugin file.
 *
 *   app.test({ plugins: { add: [mockPlugin({
 *     name: "stub-metrics",
 *     request: { after: ({ res }) => counts.push(res.status) },
 *   })] } })
 */

import type { HyperPlugin } from "@usehyper/core"

export function mockPlugin(plugin: HyperPlugin): HyperPlugin {
  return plugin
}
