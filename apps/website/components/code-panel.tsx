interface CodePanelProps {
  readonly code: string
  /** Optional bordered callout under the block, e.g. running output. */
  readonly running?: string
}

/**
 * Plain text-document code block — thin gray border, monospace, no
 * syntax highlighting, no shadows, no tab strip. The content is
 * preserved verbatim including all whitespace.
 *
 * The optional `running` callout is rendered as a borderless follow-on
 * panel underneath the block (the way `code.storage` shows status text).
 */
export function CodePanel({ code, running }: CodePanelProps) {
  return (
    <div className="my-6">
      <pre className="code-block">
        <code>{code}</code>
      </pre>
      {running ? <div className="callout">{running}</div> : null}
    </div>
  )
}
