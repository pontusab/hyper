import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { Letterhead } from "@/components/letterhead"
import { loadManifests } from "@/lib/manifests"

export const metadata: Metadata = {
  title: "Registry",
  description: "Every component in the Hyper registry. Install with the CLI, own the source.",
  alternates: { canonical: "https://hyperjs.ai/registry" },
}

export const revalidate = 300

export default async function RegistryPage() {
  const { index } = await loadManifests()
  const rows = [...index.components].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main>
      <Letterhead />

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h1 className="h-doc h-doc-1 mb-6">THE REGISTRY</h1>
        <div className="space-y-5 text-[13px] leading-[1.7]">
          <p>
            {index.components.length} components. Install with{" "}
            <span className="ic">hyper add &lt;name&gt;</span> — the CLI copies
            the files into <span className="ic">src/hyper/</span>, records each
            file in <span className="ic">hyper.lock.json</span>, and patches
            your <span className="ic">tsconfig.json</span> aliases.
          </p>
          <p>
            For AI agents, point any MCP-aware client at{" "}
            <Link href="/mcp">
              <span className="ic">https://hyperjs.ai/mcp</span>
            </Link>{" "}
            and use the <span className="ic">listComponents</span> /{" "}
            <span className="ic">searchComponent</span> tools.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h2 className="h-doc h-doc-2 mb-6">COMPONENTS</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase text-[var(--color-fg-muted)]">
              <th className="py-2 pr-4 font-semibold">name</th>
              <th className="py-2 pr-4 font-semibold">version</th>
              <th className="py-2 pr-4 font-semibold">files</th>
              <th className="py-2 font-semibold">description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.name}
                className="border-b border-[var(--color-line-soft)] align-top"
              >
                <td className="py-2 pr-4">
                  <Link href={`/c/${c.name}`}>
                    <span className="ic">{c.name}</span>
                  </Link>
                </td>
                <td className="py-2 pr-4 text-[var(--color-fg-muted)]">
                  {c.version}
                </td>
                <td className="py-2 pr-4 text-[var(--color-fg-muted)]">
                  {c.fileCount}
                </td>
                <td className="py-2 leading-[1.5]">
                  {c.description}
                  {c.registryDeps.length > 0 ? (
                    <span className="ml-2 text-[11px] text-[var(--color-fg-subtle)]">
                      needs {c.registryDeps.join(", ")}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-[11px] text-[var(--color-fg-muted)]">
          generated {index.generatedAt}
        </p>
      </section>

      <Footer />
    </main>
  )
}
