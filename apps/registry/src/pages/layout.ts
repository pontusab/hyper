/**
 * Tiny HTML layout. Inlined CSS, no JS, no build step — this is a content
 * site. The CSS is a flat reset + a small typography scale.
 */

const CSS = `
:root {
  --bg: #0b0d10;
  --fg: #e7eaee;
  --muted: #94a0ad;
  --accent: #5eead4;
  --link: #93c5fd;
  --code-bg: #14181d;
  --border: #232a32;
  font-family: ui-sans-serif, system-ui, -apple-system, "Inter", sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.55;
}
main {
  max-width: 920px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}
header {
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
header .brand {
  font-weight: 700;
  letter-spacing: -0.02em;
  font-size: 1.05rem;
}
header .brand .accent { color: var(--accent); }
header nav a {
  color: var(--muted);
  text-decoration: none;
  margin-left: 1rem;
  font-size: 0.9rem;
}
header nav a:hover { color: var(--fg); }
h1 { font-size: 2.25rem; line-height: 1.15; letter-spacing: -0.025em; margin: 0 0 0.5rem; }
h2 { font-size: 1.4rem; line-height: 1.2; letter-spacing: -0.02em; margin: 2rem 0 0.5rem; }
h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
p { color: var(--fg); margin: 0.5rem 0 1rem; }
a { color: var(--link); }
code, pre {
  font-family: ui-monospace, "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.9rem;
}
code {
  background: var(--code-bg);
  border: 1px solid var(--border);
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
}
pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  padding: 0.85rem 1rem;
  border-radius: 6px;
  overflow-x: auto;
}
pre code { background: transparent; border: 0; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
th, td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 0.85rem; }
td.dim { color: var(--muted); font-size: 0.9rem; }
.muted { color: var(--muted); }
.hint { color: var(--muted); font-size: 0.9rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
@media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
.copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  padding: 0.55rem 0.85rem;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  margin: 0.5rem 0;
}
.tag {
  display: inline-block;
  background: rgba(94, 234, 212, 0.08);
  color: var(--accent);
  border: 1px solid rgba(94, 234, 212, 0.25);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.75rem;
  margin-right: 0.4rem;
  font-weight: 500;
}
footer {
  border-top: 1px solid var(--border);
  padding: 1.5rem;
  color: var(--muted);
  font-size: 0.85rem;
  text-align: center;
}
`

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export interface PageOptions {
  readonly title: string
  readonly description?: string
  readonly canonical?: string
}

export function layout(body: string, opts: PageOptions): string {
  const desc = opts.description ?? "Bun-first, AI-native API framework."
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
${opts.canonical ? `<link rel="canonical" href="${escapeHtml(opts.canonical)}" />` : ""}
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="brand"><span class="accent">hyper</span>js.ai</div>
  <nav>
    <a href="/">registry</a>
    <a href="https://github.com/usehyper/hyper">github</a>
    <a href="/mcp">mcp</a>
  </nav>
</header>
<main>${body}</main>
<footer>
  Hyper — Bun-first, AI-native APIs · MIT
</footer>
</body>
</html>
`
}
