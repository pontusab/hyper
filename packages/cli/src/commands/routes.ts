import type { HyperApp, Route } from "@hyper/core"
import { type ParsedArgs, isJson } from "../args.ts"
import { resolveEntry } from "../entry.ts"
import { loadApp } from "../load-app.ts"

export async function runRoutes(args: ParsedArgs): Promise<number> {
  const entry = await resolveEntry(args.positional)
  if (!entry) {
    console.error("error: no entry file found (tried src/app.ts, app.ts, src/index.ts)")
    return 2
  }
  const app = await loadApp(entry)
  if (!app) {
    console.error(`error: no default/named 'app' export in ${entry}`)
    return 2
  }
  const list = app.routeList.map((r) => ({
    method: r.method,
    path: r.path,
    name: r.meta.name,
    tags: r.meta.tags ?? [],
    mcp: Boolean(r.meta.mcp),
  }))
  if (isJson(args.flags)) {
    console.log(JSON.stringify(list, null, 2))
    return 0
  }
  printTable(list, app.routeList)
  return 0
}

function printTable(
  list: readonly { method: string; path: string; name: string | undefined; mcp: boolean }[],
  routes: readonly Route[],
): void {
  const methodW = Math.max(6, ...list.map((r) => r.method.length))
  const pathW = Math.max(4, ...list.map((r) => r.path.length))
  console.log(`${"method".padEnd(methodW)}  ${"path".padEnd(pathW)}  name / meta`)
  console.log(`${"".padEnd(methodW, "-")}  ${"".padEnd(pathW, "-")}  -----------`)
  for (const r of list) {
    const mcpTag = r.mcp ? "  [mcp]" : ""
    console.log(`${r.method.padEnd(methodW)}  ${r.path.padEnd(pathW)}  ${r.name ?? ""}${mcpTag}`)
  }
  console.log(`\n${routes.length} route(s)`)
}
