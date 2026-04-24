/**
 * Audit — pretty-print or JSON-dump the MCP-exposed surface, including
 * auth requirements inferred from route meta.
 */

import type { HyperApp } from "@usehyper/core"

export interface AuditReport {
  readonly exposedCount: number
  readonly total: number
  readonly tools: readonly {
    readonly name: string
    readonly description: string
    readonly method: string
    readonly path: string
    readonly requiresAuth: boolean
  }[]
}

export function auditMcp(app: HyperApp): AuditReport {
  const manifest = app.toMCPManifest()
  const byPath = new Map(app.routeList.map((r) => [`${r.method} ${r.path}`, r]))
  const tools = manifest.tools.map((t) => {
    const route = byPath.get(`${t.method} ${t.path}`)
    const requiresAuth = Boolean(
      route && (route.meta.authEndpoint || route.meta.tags?.includes("auth")),
    )
    return {
      name: t.name,
      description: t.description,
      method: t.method,
      path: t.path,
      requiresAuth,
    }
  })
  return {
    exposedCount: tools.length,
    total: app.routeList.filter((r) => !r.meta.internal).length,
    tools,
  }
}

export function formatAuditHuman(report: AuditReport): string {
  const lines: string[] = []
  lines.push(`MCP surface: ${report.exposedCount}/${report.total} routes exposed\n`)
  for (const t of report.tools) {
    const auth = t.requiresAuth ? " [auth]" : ""
    lines.push(`  ${t.method.padEnd(6)} ${t.path}${auth}`)
    lines.push(`    ${t.description}`)
  }
  return lines.join("\n")
}
