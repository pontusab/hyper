/**
 * JSON Schemas for the Hyper registry — published at stable, IDE-friendly URLs.
 *
 *   GET https://hyperjs.ai/schema.json                   -> hyper.config.json schema (alias)
 *   GET https://hyperjs.ai/schema/hyper-config.json      -> hyper.config.json schema
 *   GET https://hyperjs.ai/schema/registry-item.json     -> single-component manifest
 *   GET https://hyperjs.ai/schema/registry.json          -> registry index
 *
 * Pure constants — kept in their own module so consumers (the registry app,
 * the snapshot generator, the build tool) can import without pulling in the
 * live builder (which reads from disk).
 */

export const REGISTRY_ITEM_SCHEMA_URL = "https://hyperjs.ai/schema/registry-item.json" as const
export const REGISTRY_INDEX_SCHEMA_URL = "https://hyperjs.ai/schema/registry.json" as const
export const HYPER_CONFIG_SCHEMA_URL = "https://hyperjs.ai/schema.json" as const

export const HYPER_CONFIG_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: HYPER_CONFIG_SCHEMA_URL,
  title: "hyper.config.json",
  description: "Configuration for the Hyper CLI's registry workflow.",
  type: "object",
  properties: {
    $schema: { type: "string" },
    registryUrl: {
      type: "string",
      format: "uri",
      description: "Base URL of the Hyper registry. Defaults to https://hyperjs.ai.",
    },
    baseDir: {
      type: "string",
      description: "Where components are installed, relative to the project root.",
    },
    alias: {
      type: "string",
      description: "Import alias for installed components, or 'relative' for relative imports.",
    },
    tsx: {
      type: "boolean",
      description: "Whether the project uses TSX/JSX. Reserved for future use.",
    },
  },
  required: ["baseDir", "alias"],
  additionalProperties: false,
} as const

export const REGISTRY_ITEM_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: REGISTRY_ITEM_SCHEMA_URL,
  title: "Hyper registry component",
  description: "Manifest for a single component served at /r/<name>.json.",
  type: "object",
  properties: {
    $schema: { type: "string" },
    name: { type: "string", description: "Stable identifier (e.g. 'cors')." },
    version: { type: "string", description: "Semantic version of this snapshot." },
    title: { type: "string", description: "Human-readable display name." },
    description: { type: "string" },
    readme: { type: "string", description: "Full README markdown." },
    registryDeps: {
      type: "array",
      items: { type: "string" },
      description: "Other registry components this one depends on.",
    },
    peerDeps: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "npm peer dependencies.",
    },
    optionalPeerDeps: {
      type: "object",
      additionalProperties: { type: "string" },
    },
    files: {
      type: "array",
      description: "All source files copied into the user's repo.",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          contents: { type: "string" },
          sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
          target: {
            type: "string",
            description:
              "Optional override for where this file lands. Placeholders: @base/, @root/, @cursor/, ~/.",
          },
        },
        required: ["path", "contents", "sha256"],
        additionalProperties: false,
      },
    },
    subpaths: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Subpath aliases mapping import suffix to file (without `.ts`).",
    },
    envVars: {
      type: "object",
      additionalProperties: { type: "string" },
      description:
        "Env vars appended to .env.local. Supports ${random:hex:N} and ${random:base64:N} resolved locally.",
    },
    docs: {
      type: "string",
      description: "Markdown blurb printed by the CLI after install.",
    },
  },
  required: [
    "name",
    "version",
    "description",
    "readme",
    "registryDeps",
    "peerDeps",
    "optionalPeerDeps",
    "files",
    "subpaths",
  ],
  additionalProperties: true,
} as const

export const REGISTRY_INDEX_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: REGISTRY_INDEX_SCHEMA_URL,
  title: "Hyper registry index",
  description: "Lightweight catalog served at /r/index.json.",
  type: "object",
  properties: {
    $schema: { type: "string" },
    schema: { const: 1 },
    generatedAt: { type: "string", format: "date-time" },
    source: { type: "string", format: "uri" },
    components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          registryDeps: { type: "array", items: { type: "string" } },
          fileCount: { type: "integer", minimum: 0 },
        },
        required: ["name", "version", "description", "registryDeps", "fileCount"],
        additionalProperties: false,
      },
    },
  },
  required: ["schema", "generatedAt", "source", "components"],
  additionalProperties: true,
} as const
