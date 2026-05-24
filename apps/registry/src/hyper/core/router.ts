/**
 * Dev router — zero-dep trie that mirrors `Bun.serve({ routes })`
 * semantics so dev and prod behave identically.
 *
 * Supported patterns:
 * - Static:           "/users"
 * - Param:            "/users/:id"
 * - Mixed-segment:    "/r/:slug.json", "/r/:name@:version.json", "/posts/:y-:m-:d", "/v:version/users"
 * - Wildcard:         "/api/*"
 *
 * A "mixed" segment is one with literal characters around or between params.
 * It compiles to a regex once at route-add time; the runtime walker uses
 * `pattern.exec(segment)` only for those nodes. Pure-segment params keep the
 * zero-allocation static fast path unchanged.
 *
 * Multiple mixed patterns may share a parent node — they're tried in
 * descending order of specificity (more literal characters wins), so
 * `/r/:name@:version.json` is preferred over `/r/:name.json` when both
 * match. Within the same specificity, registration order wins.
 *
 * Param names are `[A-Za-z_][A-Za-z0-9_]*`. Anything else in the segment is a
 * literal byte that must match the request path verbatim.
 *
 * Method-keyed dispatch is handled at the Route level (one compiled handler
 * per verb); the router only matches paths.
 */

import type { HttpMethod, Route } from "./types.ts"

export interface MatchResult {
  readonly route: Route
  readonly params: Record<string, string>
}

interface PureParam {
  readonly name: string
  readonly node: Node
}

interface MixedParam {
  /** Original pattern segment, used for diagnostics. */
  readonly pattern: string
  /** Compiled regex anchored to the full segment. */
  readonly regex: RegExp
  /** Capture-group names in order. */
  readonly names: readonly string[]
  /** Count of literal characters — higher wins ties at match time. */
  readonly literalChars: number
  readonly node: Node
}

interface Node {
  /** Static children: "users" -> Node */
  statics: Map<string, Node>
  /** Single pure-segment param child (`:id`). */
  pureParam?: PureParam
  /**
   * Mixed-segment children (`:slug.json`, `:a@:b`, ...). Multiple may
   * coexist at the same depth — tried in descending specificity order at
   * match time.
   */
  mixedParams?: MixedParam[]
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
      const parsed = parsePatternSegment(seg)
      if (parsed === "static") {
        let child = cur.statics.get(seg)
        if (!child) {
          child = newNode()
          cur.statics.set(seg, child)
        }
        cur = child
        continue
      }
      if (parsed.kind === "pure") {
        if (!cur.pureParam) {
          cur.pureParam = { name: parsed.name, node: newNode() }
        } else if (cur.pureParam.name !== parsed.name) {
          throw new Error(
            `Route conflict: ${route.path} has param :${parsed.name} but trie already uses :${cur.pureParam.name}`,
          )
        }
        cur = cur.pureParam.node
        continue
      }
      // Mixed pattern — multiple may coexist at the same depth.
      if (!cur.mixedParams) cur.mixedParams = []
      const existing = cur.mixedParams.find((m) => m.pattern === seg)
      if (existing) {
        cur = existing.node
        continue
      }
      const slot: MixedParam = {
        pattern: seg,
        regex: parsed.regex,
        names: parsed.names,
        literalChars: parsed.literalChars,
        node: newNode(),
      }
      cur.mixedParams.push(slot)
      // Most specific (highest literal count) first; ties keep registration order.
      cur.mixedParams.sort((a, b) => b.literalChars - a.literalChars)
      cur = slot.node
    }
    if (!cur.handlers) cur.handlers = {}
    if (cur.handlers[route.method]) {
      throw new Error(`Duplicate route: ${route.method} ${route.path}`)
    }
    cur.handlers[route.method] = route
  }

  find(method: HttpMethod, pathname: string): MatchResult | null {
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
 * Iterates the pathname by slicing between `/` delimiters directly on the
 * string — no segments array, no params object, no closures. When a `:param`,
 * mixed pattern, or `*` node is encountered we switch to the `walkWithParams`
 * helper which handles backtracking.
 */
function walkInline(root: Node, pathname: string): WalkHit | null {
  let i = pathname.charCodeAt(0) === 47 /* '/' */ ? 1 : 0
  const len = pathname.length
  let node: Node = root

  // Empty path (`/` or ``) matches the root.
  if (i >= len) return { node, params: null }

  while (i < len) {
    let j = i
    while (j < len && pathname.charCodeAt(j) !== 47) j++
    const seg = pathname.slice(i, j)

    const stat = node.statics.get(seg)
    if (stat && !node.pureParam && !node.mixedParams && !node.wildcard) {
      // Unambiguous static step — no backtracking possible.
      node = stat
      i = j + 1
      continue
    }
    return walkWithParams(node, pathname, i)
  }
  return { node, params: null }
}

function walkWithParams(startNode: Node, pathname: string, startIndex: number): WalkHit | null {
  const params: Record<string, string> = {}
  const hit = walkRecur(startNode, pathname, startIndex, params)
  if (!hit) return null
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

  // 1) Static (most specific) wins first.
  const stat = node.statics.get(seg)
  if (stat) {
    if (nextIndex > len) return stat
    const r = walkRecur(stat, pathname, nextIndex, params)
    if (r) return r
  }

  // 2a) Mixed-segment params first (most specific to least specific).
  if (node.mixedParams) {
    for (const mp of node.mixedParams) {
      const m = mp.regex.exec(seg)
      if (!m) continue
      const captured = mp.names
      for (let k = 0; k < captured.length; k++) {
        const name = captured[k]
        if (name !== undefined) {
          const value = m[k + 1]
          params[name] = value === undefined ? "" : decodeURIComponent(value)
        }
      }
      if (nextIndex > len) return mp.node
      const r = walkRecur(mp.node, pathname, nextIndex, params)
      if (r) return r
      for (const name of captured) delete params[name]
    }
  }

  // 2b) Pure-segment param.
  if (node.pureParam) {
    const name = node.pureParam.name
    params[name] = decodeURIComponent(seg)
    if (nextIndex > len) return node.pureParam.node
    const r = walkRecur(node.pureParam.node, pathname, nextIndex, params)
    if (r) return r
    delete params[name]
  }

  // 3) Wildcard catch-all.
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
  if (node.pureParam) yield* enumerate(node.pureParam.node)
  if (node.mixedParams) for (const mp of node.mixedParams) yield* enumerate(mp.node)
  if (node.wildcard) yield* enumerate(node.wildcard)
}

// ---------------------------------------------------------------------------
// Pattern parsing
// ---------------------------------------------------------------------------

type ParsedSegment =
  | "static"
  | { readonly kind: "pure"; readonly name: string }
  | {
      readonly kind: "mixed"
      readonly regex: RegExp
      readonly names: readonly string[]
      readonly literalChars: number
    }

const IDENT_HEAD = /[A-Za-z_]/
const IDENT_REST = /[A-Za-z0-9_]/

function parsePatternSegment(seg: string): ParsedSegment {
  // Fast path: no `:` means pure-static.
  if (seg.indexOf(":") === -1) return "static"

  // Single `:name` covering the whole segment? -> pure param (fast path).
  if (seg.length > 1 && seg.charCodeAt(0) === 58 /* ':' */) {
    let k = 1
    if (k < seg.length && IDENT_HEAD.test(seg.charAt(k))) {
      k++
      while (k < seg.length && IDENT_REST.test(seg.charAt(k))) k++
      if (k === seg.length) return { kind: "pure", name: seg.slice(1) }
    }
  }

  // Mixed segment — scan and build a regex, capturing each `:name`.
  const names: string[] = []
  let pattern = "^"
  let literalChars = 0
  let i = 0
  while (i < seg.length) {
    const ch = seg.charAt(i)
    if (ch === ":" && i + 1 < seg.length && IDENT_HEAD.test(seg.charAt(i + 1))) {
      let k = i + 1
      while (k < seg.length && IDENT_REST.test(seg.charAt(k))) k++
      const name = seg.slice(i + 1, k)
      if (names.includes(name)) {
        throw new Error(`Duplicate param :${name} in segment "${seg}"`)
      }
      names.push(name)
      pattern += "([^/]+?)"
      i = k
      continue
    }
    pattern += escapeRegexChar(ch)
    literalChars += 1
    i++
  }
  pattern += "$"
  return { kind: "mixed", regex: new RegExp(pattern), names, literalChars }
}

const REGEX_META = new Set(".*+?^${}()|[]\\".split(""))
function escapeRegexChar(ch: string): string {
  return REGEX_META.has(ch) ? `\\${ch}` : ch
}
