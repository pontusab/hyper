import Link from "next/link"

/**
 * Three-line letterhead at the top of the document, with a bracketed
 * link column floated to the right. No logo, no styling — just text.
 *
 *   HYPERJS.AI                            [ DOCS ]
 *   HYPER                                 [ REGISTRY ]
 *   2026                                  [ GITHUB ]
 */
export function Letterhead() {
  return (
    <header className="grid grid-cols-2 gap-x-8 px-6 pt-6 pb-10 text-[12px] uppercase leading-tight tracking-wide sm:px-10">
      <div>
        <div className="font-bold">HYPERJS.AI</div>
      </div>
      <div className="flex flex-col items-end">
        <Bracket href="/docs">DOCS / GET STARTED</Bracket>
        <Bracket href="https://hyperjs.ai">REGISTRY</Bracket>
        <Bracket href="https://github.com/usehyper/hyper">GITHUB</Bracket>
      </div>
    </header>
  )
}

function Bracket({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="no-underline hover:bg-[var(--color-mark)]">
      [ {children} ]
    </Link>
  )
}
