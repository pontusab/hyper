/**
 * Swagger UI handler — self-contained HTML + redirect to /openapi.json.
 * CDN-loaded; no bundling required.
 */

export interface SwaggerHtmlOptions {
  readonly specUrl?: string
  readonly title?: string
}

export function swaggerHtml(opts: SwaggerHtmlOptions = {}): string {
  const spec = opts.specUrl ?? "/openapi.json"
  const title = opts.title ?? "API Docs"
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0 }</style>
</head>
<body>
  <div id="ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(spec)},
      dom_id: "#ui",
      deepLinking: true,
      docExpansion: "list",
    })
  </script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  )
}
