/**
 * Dev router — zero-dep trie that mirrors `Bun.serve({ routes })`
 * semantics so dev and prod behave identically.
 *
 * Supported patterns (same as Bun's router):
 * - Static: "/users"
 * - Param:  "/users/:id"
 * - Wildcard: "/api/*"
 * - Method-keyed dispatch is handled at the Route level (one compiled
 *   handler per verb); the router only matches paths.
 */

import type { HttpMethod, Route } from "./types.ts"

export interface MatchResult {
  readonly route: Route
  readonly params: Record<string, string>
}

interface Node {
  /** Static children: "users" -> Node */
  statics: Map<string, Node>
  /** Param child: ":id" */
  param?: { name: string; node: Node }
  /** Wildcard child: "*" */
  wildcard?: Node
  /** Routes terminating at this node, keyed by method. */
  handlers?: Partial<Record<HttpMethod, Route>>
}

export class Router {
  readonly #root: Node = newNode()

  add(route: Route): void {
    const segments = splitPath(route.path)
    let cur = this.#root
    for (const seg of segments) {
      if (seg === "*" || seg.startsWith("*")) {
        if (!cur.wildcard) cur.wildcard = newNode()
        cur = cur.wildcard
        break
      }
      if (seg.startsWith(":")) {
        const name = seg.slice(1)
        if (!cur.param) cur.param = { name, node: newNode() }
        else if (cur.param.name !== name) {
          throw new Error(
            `Route conflict: ${route.path} has param :${name} but trie already uses :${cur.param.name}`,
          )
        }
        cur = cur.param.node
        continue
      }
      let child = cur.statics.get(seg)
      if (!child) {
        child = newNode()
        cur.statics.set(seg, child)
      }
      cur = child
    }
    if (!cur.handlers) cur.handlers = {}
    if (cur.handlers[route.method]) {
      throw new Error(`Duplicate route: ${route.method} ${route.path}`)
    }
    cur.handlers[route.method] = route
  }

  find(method: HttpMethod, pathname: string): MatchResult | null {
    // Inline scan over pathname — no `split("/")` allocation. Params
    // are lazily allocated; the common static-route case pays zero
    // object allocations in the happy path.
    const matched = walkInline(this.#root, pathname)
    if (!matched) return null
    const route = matched.node.handlers?.[method]
    if (!route) {
      // Fallback: HEAD uses GET; OPTIONS handled by caller.
      if (method === "HEAD") {
        const getRoute = matched.node.handlers?.GET
        if (getRoute) return { route: getRoute, params: matched.params ?? EMPTY_PARAMS }
      }
      return null
    }
    return { route, params: matched.params ?? EMPTY_PARAMS }
  }

  /** Enumerate all routes for introspection. */
  *all(): Generator<Route> {
    yield* enumerate(this.#root)
  }
}

function newNode(): Node {
  return { statics: new Map() }
}

const EMPTY_PARAMS: Record<string, string> = Object.freeze(
  Object.create(null) as Record<string, string>,
) as Record<string, string>

function splitPath(path: string): string[] {
  const trimmed = path.startsWith("/") ? path.slice(1) : path
  if (trimmed === "") return []
  return trimmed.split("/")
}

interface WalkHit {
  readonly node: Node
  /** Lazily allocated — `null` means "no params were matched". */
  readonly params: Record<string, string> | null
}

/**
 * Zero-allocation walker for the static fast path.
 *
 * Iterates the pathname by slicing between `/` delimiters directly on
 * the string — no segments array, no params object, no closures.
 * When a `:param` or `*` node is encountered we switch to the
 * `walkWithParams` helper which handles backtracking.
 */
function walkInline(root: Node, pathname: string): WalkHit | null {
  let i = pathname.charCodeAt(0) === 47 /* '/' */ ? 1 : 0
  const len = pathname.length
  let node: Node = root

  // Empty path (`/` or ``) matches the root.
  if (i >= len) return { node, params: null }

  while (i < len) {
    // Find the next '/'
    let j = i
    while (j < len && pathname.charCodeAt(j) !== 47) j++
    const seg = pathname.slice(i, j)

    const stat = node.statics.get(seg)
    if (stat && !node.param && !node.wildcard) {
      // Unambiguous static step — no backtracking possible.
      node = stat
      i = j + 1
      continue
    }
    // Ambiguity (or non-static hit) — delegate to the backtracking path.
    return walkWithParams(node, pathname, i)
  }
  return { node, params: null }
}

function walkWithParams(startNode: Node, pathname: string, startIndex: number): WalkHit | null {
  const params: Record<string, string> = {}
  const hit = walkRecur(startNode, pathname, startIndex, params)
  if (!hit) return null
  // If params ended up empty, drop the object.
  for (const _k in params) return { node: hit, params }
  return { node: hit, params: null }
}

function walkRecur(
  node: Node,
  pathname: string,
  i: number,
  params: Record<string, string>,
): Node | null {
  const len = pathname.length
  if (i >= len) return node
  let j = i
  while (j < len && pathname.charCodeAt(j) !== 47) j++
  const seg = pathname.slice(i, j)
  const nextIndex = j + 1

  const stat = node.statics.get(seg)
  if (stat) {
    if (nextIndex > len) return stat
    const r = walkRecur(stat, pathname, nextIndex, params)
    if (r) return r
  }
  if (node.param) {
    const name = node.param.name
    params[name] = decodeURIComponent(seg)
    if (nextIndex > len) return node.param.node
    const r = walkRecur(node.param.node, pathname, nextIndex, params)
    if (r) return r
    delete params[name]
  }
  if (node.wildcard) {
    params["*"] = decodeURIComponent(pathname.slice(i))
    return node.wildcard
  }
  return null
}

function* enumerate(node: Node): Generator<Route> {
  if (node.handlers) {
    for (const v of Object.values(node.handlers)) if (v) yield v
  }
  for (const child of node.statics.values()) yield* enumerate(child)
  if (node.param) yield* enumerate(node.param.node)
  if (node.wildcard) yield* enumerate(node.wildcard)
}
