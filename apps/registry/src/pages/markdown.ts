/**
 * Tiny markdown renderer — covers what the Hyper READMEs actually use:
 *   #/##/### headings, paragraphs, fenced code blocks, inline code,
 *   bold (**), italic (*), unordered + ordered lists, links, blockquotes.
 *
 * Deliberately small (≈100 LOC) and dependency-free — this is a content
 * site that doesn't justify pulling marked/markdown-it.
 */

import { escapeHtml } from "./layout.ts"

export function renderMarkdown(input: string): string {
  // Normalize newlines.
  const src = input.replace(/\r\n?/g, "\n").trim()
  const lines = src.split("\n")
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Fenced code block
    const fence = /^```(\w+)?$/.exec(line)
    if (fence) {
      const lang = fence[1] ?? ""
      const block: string[] = []
      i += 1
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        block.push(lines[i]!)
        i += 1
      }
      i += 1
      out.push(
        `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(block.join("\n"))}</code></pre>`,
      )
      continue
    }

    // ATX headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`)
      i += 1
      continue
    }

    // Blockquote
    if (line.startsWith(">")) {
      const block: string[] = []
      while (i < lines.length && lines[i]!.startsWith(">")) {
        block.push(lines[i]!.replace(/^>\s?/, ""))
        i += 1
      }
      out.push(`<blockquote><p>${inline(block.join(" ").trim())}</p></blockquote>`)
      continue
    }

    // Lists (unordered or ordered, no nesting)
    if (/^(?:[-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^(?:[-*]|\d+\.)\s/.test(lines[i] ?? "")) {
        const item = lines[i]!.replace(/^(?:[-*]|\d+\.)\s+/, "")
        items.push(`<li>${inline(item)}</li>`)
        i += 1
      }
      const tag = ordered ? "ol" : "ul"
      out.push(`<${tag}>${items.join("")}</${tag}>`)
      continue
    }

    // Blank line
    if (line.trim() === "") {
      i += 1
      continue
    }

    // Paragraph (collect until blank line / structural marker)
    const para: string[] = [line]
    i += 1
    while (i < lines.length) {
      const nx = lines[i]!
      if (
        nx.trim() === "" ||
        /^#{1,6}\s/.test(nx) ||
        /^```/.test(nx) ||
        /^>/.test(nx) ||
        /^(?:[-*]|\d+\.)\s/.test(nx)
      ) {
        break
      }
      para.push(nx)
      i += 1
    }
    out.push(`<p>${inline(para.join(" ").trim())}</p>`)
  }

  return out.join("\n")
}

function inline(s: string): string {
  let out = escapeHtml(s)
  // Inline code first (so it doesn't get bolded etc.)
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
  // Bold + italic
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    return `<a href="${url}">${text}</a>`
  })
  return out
}
