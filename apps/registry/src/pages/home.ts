/**
 * `GET /` — landing page + browseable component catalog.
 *
 * Renders the index manifest as a sortable table. Includes the install
 * one-liner and a link to each per-component page (`/c/<name>`).
 */

import type { Index } from "../manifests.ts"
import { escapeHtml, layout } from "./layout.ts"

export function renderHome(index: Index): string {
  const rows = [...index.components]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const deps = c.registryDeps.length
        ? `<span class="hint">needs ${c.registryDeps.map(escapeHtml).join(", ")}</span>`
        : ""
      return `
        <tr>
          <td><a href="/c/${escapeHtml(c.name)}"><code>${escapeHtml(c.name)}</code></a></td>
          <td class="dim">${escapeHtml(c.version)}</td>
          <td>${escapeHtml(c.description)} ${deps}</td>
          <td class="dim">${c.fileCount}</td>
        </tr>`
    })
    .join("")

  const body = `
<h1>The Hyper registry</h1>
<p class="muted">${index.components.length} components — install with the CLI, own the source.</p>

<h2>Install the CLI</h2>
<div class="copy"><code>bun add -D @usehyper/cli</code></div>

<h2>Bootstrap a project</h2>
<div class="copy"><code>bunx @usehyper/cli init my-app --template api</code></div>
<p class="hint">Scaffolds a Hyper app, writes <code>hyper.config.json</code>, patches your <code>tsconfig.json</code>, and copies <code>core</code> + <code>log</code> into <code>src/hyper/</code>.</p>

<h2>Components</h2>
<table>
  <thead><tr><th>name</th><th>version</th><th>description</th><th>files</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<h2>For AI agents</h2>
<p>Cursor, Claude Desktop, and any MCP-aware tool can install components conversationally — point them at:</p>
<div class="copy"><code>https://hyperjs.ai/mcp</code></div>
<p>Or drop in the agent rules:</p>
<div class="copy"><code>hyper add agent-rules</code></div>

<h3 class="hint">Generated ${escapeHtml(index.generatedAt)}</h3>
`
  return layout(body, {
    title: "hyperjs.ai — registry",
    description:
      "Bun-first, AI-native API framework. Components install via CLI, source lives in your repo.",
    canonical: "https://hyperjs.ai/",
  })
}
