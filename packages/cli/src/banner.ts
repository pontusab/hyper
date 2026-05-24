/**
 * Welcome banner printed at the top of `hyper init`. Deliberately scoped
 * to the scaffolding moment — every other command stays terse so output
 * is friendly to pipes, agent loops, and CI logs.
 *
 * Suppressed when:
 *   - `--json` is set (the caller wants machine output)
 *   - stdout isn't a TTY (piped or redirected)
 *   - `CI` is set (CI runners log this verbatim)
 *
 * The shape is the figlet "small" font for "hyper". Exact widths preserved
 * so it lines up the same in any monospace terminal.
 */

const LOGO = String.raw`
 _
| |_  _ _ __   ___ _ __
| ' \| || | '_ \ / -_) '_|
|_||_|\_, | .__/ \___|_|
      |__/|_|
`

export interface BannerOptions {
  readonly json?: boolean
}

export function printBanner(version: string, opts: BannerOptions = {}): void {
  if (opts.json) return
  if (process.env.CI) return
  if (process.env.HYPER_NO_BANNER) return
  if (!process.stdout.isTTY) return
  process.stdout.write(LOGO)
  process.stdout.write(`v${version} · API framework for Bun, distributed as source\n\n`)
}
