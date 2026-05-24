/**
 * Tiny markdown renderer — covers what the Hyper READMEs actually use:
 *   #/##/### headings, paragraphs, fenced code blocks, inline code,
 *   bold (**), italic (*), unordered + ordered lists, links, blockquotes.
 *
 * Deliberately small (≈100 LOC) and dependency-free — this is a content
 * site that doesn't justify pulling marked/markdown-it.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function renderMarkdown(input: string): string {
  const src = input.replace(/\r\n?/g, "\n").trim()
  const lines = src.split("\n")
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

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

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`)
      i += 1
      continue
    }

    if (line.startsWith(">")) {
      const block: string[] = []
      while (i < lines.length && lines[i]!.startsWith(">")) {
        block.push(lines[i]!.replace(/^>\s?/, ""))
        i += 1
      }
      out.push(`<blockquote><p>${inline(block.join(" ").trim())}</p></blockquote>`)
      continue
    }

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

    if (line.trim() === "") {
      i += 1
      continue
    }

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
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    return `<a href="${url}">${text}</a>`
  })
  return out
}
