/**
 * `GET /c/<name>` — per-component detail page.
 *
 * Shows the rendered README, the file list, deps, and the install snippet.
 */

import type { Manifest } from "../manifests.ts"
import { escapeHtml, layout } from "./layout.ts"
import { renderMarkdown } from "./markdown.ts"

export function renderComponentPage(m: Manifest): string {
  const readme = m.readme ? renderMarkdown(m.readme) : '<p class="muted">No README.</p>'

  const deps = m.registryDeps.length
    ? m.registryDeps
        .map((d) => `<a href="/c/${escapeHtml(d)}"><span class="tag">${escapeHtml(d)}</span></a>`)
        .join("")
    : '<span class="muted">none</span>'

  const peers = Object.entries(m.peerDeps)
    .map(([k, v]) => `<code>${escapeHtml(k)}<span class="muted">@${escapeHtml(v)}</span></code>`)
    .join(" ")
  const optionalPeers = Object.entries(m.optionalPeerDeps)
    .map(([k, v]) => `<code>${escapeHtml(k)}<span class="muted">@${escapeHtml(v)}</span></code>`)
    .join(" ")

  const fileList = m.files.map((f) => `<li><code>${escapeHtml(f.path)}</code></li>`).join("")

  const body = `
<h1>${escapeHtml(m.name)} <span class="muted" style="font-size: 1.1rem;">${escapeHtml(m.version)}</span></h1>
<p>${escapeHtml(m.description)}</p>

<h2>Install</h2>
<div class="copy"><code>hyper add ${escapeHtml(m.name)}</code></div>
<p class="hint">
  Copies ${m.files.length} file(s) into <code>src/hyper/${escapeHtml(m.name)}/</code> and updates <code>hyper.lock.json</code>.
</p>

<h2>Dependencies</h2>
<p><strong>Registry deps:</strong> ${deps}</p>
${peers ? `<p><strong>Peer deps:</strong> ${peers}</p>` : ""}
${optionalPeers ? `<p><strong>Optional peers:</strong> ${optionalPeers}</p>` : ""}

<h2>Files</h2>
<ul>${fileList}</ul>

<h2>README</h2>
${readme}

<h2>Manifest</h2>
<p class="hint">
  <a href="/r/${escapeHtml(m.name)}.json"><code>/r/${escapeHtml(m.name)}.json</code></a> ·
  <a href="/r/${escapeHtml(m.name)}@${escapeHtml(m.version)}.json"><code>/r/${escapeHtml(m.name)}@${escapeHtml(m.version)}.json</code></a> (immutable)
</p>
`
  return layout(body, {
    title: `${m.name} · hyperjs.ai`,
    description: m.description,
    canonical: `https://hyperjs.ai/c/${m.name}`,
  })
}
