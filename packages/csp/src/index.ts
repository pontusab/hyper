/**
 * @usehyper/csp — Content-Security-Policy + strict-by-default siblings.
 *
 * Most Hyper deployments serve JSON APIs and never render HTML, so the
 * default policy is extremely restrictive:
 *
 *   default-src 'none'; frame-ancestors 'none'; base-uri 'none';
 *   form-action 'none'; object-src 'none'; upgrade-insecure-requests
 *
 * Consumers that serve HTML can provide a tighter HTML-shaped policy
 * using `cspPlugin({ directives: {...} })`. Per-response nonces are
 * minted when `noncePlaceholder` is set — the handler can read the
 * nonce from `ctx.cspNonce` and inject it into inline `<script>` tags.
 */

import type { HyperPlugin } from "@usehyper/core"

export interface CspConfig {
  /** Emit `Content-Security-Policy-Report-Only` instead of the enforcing header. */
  readonly reportOnly?: boolean
  /** Whether to add a fresh per-response nonce to script-src/style-src. */
  readonly nonce?: boolean
  /** Key-value directive map. Values are arrays of allowed sources. */
  readonly directives?: Partial<Record<CspDirective, readonly string[]>>
  /** Report endpoint; if set, emits `report-to` + a Report-To header stub. */
  readonly reportUri?: string
  /** Extra response headers. */
  readonly headers?: {
    readonly permissionsPolicy?: string
    readonly referrerPolicy?: string
    readonly crossOriginEmbedderPolicy?: "require-corp" | "unsafe-none" | "credentialless"
    readonly crossOriginOpenerPolicy?: "same-origin" | "same-origin-allow-popups" | "unsafe-none"
    readonly crossOriginResourcePolicy?: "same-site" | "same-origin" | "cross-origin"
  }
}

export type CspDirective =
  | "default-src"
  | "base-uri"
  | "connect-src"
  | "font-src"
  | "form-action"
  | "frame-ancestors"
  | "frame-src"
  | "img-src"
  | "manifest-src"
  | "media-src"
  | "object-src"
  | "script-src"
  | "script-src-elem"
  | "script-src-attr"
  | "style-src"
  | "style-src-elem"
  | "style-src-attr"
  | "worker-src"
  | "upgrade-insecure-requests"
  | "block-all-mixed-content"

const API_DEFAULT: Partial<Record<CspDirective, readonly string[]>> = {
  "default-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "object-src": ["'none'"],
  "upgrade-insecure-requests": [],
}

declare module "@usehyper/core" {
  interface AppContext {
    readonly cspNonce?: string
  }
}

export function cspPlugin(config: CspConfig = {}): HyperPlugin {
  const directives: Record<string, readonly string[]> = {
    ...API_DEFAULT,
    ...(config.directives as Record<string, readonly string[]> | undefined),
  }
  const header = config.reportOnly
    ? "content-security-policy-report-only"
    : "content-security-policy"

  return {
    name: "@usehyper/csp",
    request: {
      before({ ctx }) {
        if (config.nonce) {
          const nonce = randomNonce()
          ;(ctx as { cspNonce?: string }).cspNonce = nonce
        }
      },
      after({ ctx, res }) {
        const merged: Record<string, readonly string[]> = { ...directives }
        if (config.nonce) {
          const n = (ctx as { cspNonce?: string }).cspNonce
          if (n) {
            merged["script-src"] = dedupe([...(merged["script-src"] ?? []), `'nonce-${n}'`])
            merged["style-src"] = dedupe([...(merged["style-src"] ?? []), `'nonce-${n}'`])
          }
        }
        if (config.reportUri) {
          merged["report-uri"] = [config.reportUri]
        }
        const value = serialize(merged)
        if (value) res.headers.set(header, value)
        if (config.reportUri && !res.headers.has("report-to")) {
          res.headers.set(
            "report-to",
            `{"group":"csp","max_age":10886400,"endpoints":[{"url":"${config.reportUri}"}]}`,
          )
        }
        const h = config.headers
        if (h?.permissionsPolicy) res.headers.set("permissions-policy", h.permissionsPolicy)
        if (h?.referrerPolicy) res.headers.set("referrer-policy", h.referrerPolicy)
        if (h?.crossOriginEmbedderPolicy) {
          res.headers.set("cross-origin-embedder-policy", h.crossOriginEmbedderPolicy)
        }
        if (h?.crossOriginOpenerPolicy) {
          res.headers.set("cross-origin-opener-policy", h.crossOriginOpenerPolicy)
        }
        if (h?.crossOriginResourcePolicy) {
          res.headers.set("cross-origin-resource-policy", h.crossOriginResourcePolicy)
        }
      },
    },
  }
}

function serialize(directives: Record<string, readonly string[]>): string {
  const parts: string[] = []
  for (const [name, values] of Object.entries(directives)) {
    if (values.length === 0) {
      parts.push(name)
    } else {
      parts.push(`${name} ${values.join(" ")}`)
    }
  }
  return parts.join("; ")
}

function dedupe(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values))
}

function randomNonce(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  let s = ""
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!)
  return btoa(s).replace(/=+$/, "")
}
