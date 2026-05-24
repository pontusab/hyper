import Link from "next/link"

const PRIMARY = [
  { href: "/docs", label: "DOCS" },
  { href: "https://hyperjs.ai", label: "REGISTRY" },
  { href: "https://hyperjs.ai/mcp", label: "MCP" },
  { href: "/changelog", label: "CHANGELOG" },
  { href: "https://github.com/pontusab/hyper", label: "GITHUB" },
  { href: "https://github.com/pontusab/hyper/issues", label: "ISSUES" },
] as const

/**
 * Plain text footer — a single line of pipe-separated links above a
 * copyright row. Mirrors the bottom of an old-school README.
 */
export function Footer() {
  return (
    <footer className="mx-auto max-w-[1100px] border-t border-[var(--color-line)] px-6 py-10 text-[11px] uppercase tracking-wide sm:px-10">
      <div className="text-[var(--color-fg-muted)]">--&minus;</div>
      <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {PRIMARY.map((link, i) => (
          <span key={link.label}>
            {i > 0 ? <span className="mr-4 text-[var(--color-fg-subtle)]">|</span> : null}
            <Link href={link.href}>{link.label}</Link>
          </span>
        ))}
      </nav>
      <div className="mt-6 flex flex-col gap-1 text-[var(--color-fg-muted)] sm:flex-row sm:justify-between">
        <span>~*~ © 2026 Hyper. MIT licensed. ~*~</span>
      </div>
    </footer>
  )
}
