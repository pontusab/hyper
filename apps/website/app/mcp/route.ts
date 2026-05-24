/**
 * `* /mcp` — JSON-RPC 2.0 endpoint exposing registry tools to AI assistants.
 *
 * Tools:
 *   listComponents          — full catalog (name + version + description + deps).
 *   searchComponent {q}     — substring filter on name/description.
 *   getComponent    {name}  — full manifest (files + readme + deps).
 *   previewComponent{name}  — manifest minus file contents (lightweight).
 *   getReadme       {name}  — just the README markdown.
 *
 *   GET — returns a help payload listing the tools and a snippet for
 *         `~/.cursor/mcp.json`. Useful for sanity-checking the endpoint in a
 *         browser.
 *   POST — JSON-RPC: `initialize`, `tools/list`, `tools/call`.
 */

import { loadManifests } from "@/lib/manifests"

interface JsonRpcRequest {
  readonly jsonrpc: "2.0"
  readonly id?: number | string | null
  readonly method: string
  readonly params?: unknown
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0"
  readonly id: number | string | null
  readonly result?: unknown
  readonly error?: { code: number; message: string; data?: unknown }
}

interface Tool {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
  readonly invoke: (args: Record<string, unknown>) => Promise<unknown>
}

async function buildTools(): Promise<readonly Tool[]> {
  const { index, byName } = await loadManifests()
  const lookup = (name: unknown) => {
    if (typeof name !== "string") throw rpcError(-32602, "name must be a string")
    const m = byName.get(name)
    if (!m) throw rpcError(-32602, `unknown component: ${name}`)
    return m
  }

  return [
    {
      name: "listComponents",
      description: "List every component in the Hyper registry with its description and deps.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      async invoke() {
        return index.components
      },
    },
    {
      name: "searchComponent",
      description: "Substring search across name and description. Returns matching index entries.",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string", description: "Case-insensitive query string." } },
        required: ["q"],
        additionalProperties: false,
      },
      async invoke(args) {
        const q = String(args.q ?? "").toLowerCase()
        return index.components.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.registryDeps.some((d) => d.toLowerCase().includes(q)),
        )
      },
    },
    {
      name: "getComponent",
      description: "Return the full manifest (files, readme, deps) for a single component.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
      async invoke(args) {
        return lookup(args.name)
      },
    },
    {
      name: "previewComponent",
      description: "Lightweight preview — manifest minus file contents.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
      async invoke(args) {
        const m = lookup(args.name)
        return {
          name: m.name,
          version: m.version,
          description: m.description,
          registryDeps: m.registryDeps,
          peerDeps: m.peerDeps,
          optionalPeerDeps: m.optionalPeerDeps,
          fileList: m.files.map((f) => f.path),
          subpaths: m.subpaths,
        }
      },
    },
    {
      name: "getReadme",
      description: "Return the README markdown for a component.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
      async invoke(args) {
        const m = lookup(args.name)
        return { name: m.name, readme: m.readme }
      },
    },
  ]
}

export async function GET(): Promise<Response> {
  const tools = await buildTools()
  return new Response(
    JSON.stringify({
      endpoint: "https://hyperjs.ai/mcp",
      protocol: "json-rpc-2.0",
      methods: ["initialize", "tools/list", "tools/call"],
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
      snippet: {
        "~/.cursor/mcp.json": {
          mcpServers: { hyper: { url: "https://hyperjs.ai/mcp" } },
        },
      },
    }),
    { headers: { "content-type": "application/json" } },
  )
}

export async function POST(req: Request): Promise<Response> {
  let msg: JsonRpcRequest
  try {
    msg = (await req.json()) as JsonRpcRequest
  } catch {
    return rpcResponse(null, { code: -32700, message: "parse error" }, 400)
  }
  const id = msg.id ?? null
  try {
    switch (msg.method) {
      case "initialize":
        return rpcOk(id, {
          serverInfo: { name: "hyperjs.ai", version: "0.1.0" },
          capabilities: { tools: {} },
        })
      case "tools/list": {
        const tools = await buildTools()
        return rpcOk(id, {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        })
      }
      case "tools/call": {
        const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
        const tools = await buildTools()
        const tool = tools.find((t) => t.name === params.name)
        if (!tool) return rpcResponse(id, { code: -32601, message: `unknown tool: ${params.name}` })
        const result = await tool.invoke(params.arguments ?? {})
        return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(result) }] })
      }
      default:
        return rpcResponse(id, { code: -32601, message: `method not found: ${msg.method}` })
    }
  } catch (err) {
    const e = err as { code?: number; message?: string; data?: unknown }
    return rpcResponse(id, { code: e.code ?? -32000, message: e.message ?? "server error" })
  }
}

function rpcOk(id: number | string | null, result: unknown): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, result }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function rpcResponse(
  id: number | string | null,
  error: { code: number; message: string; data?: unknown },
  status = 200,
): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, error }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function rpcError(code: number, message: string, _data?: unknown): Error & { code: number } {
  return Object.assign(new Error(message), { code })
}
