import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Footer } from "@/components/footer"
import { Letterhead } from "@/components/letterhead"
import { loadManifests } from "@/lib/manifests"
import { renderMarkdown } from "@/lib/markdown"

interface PageProps {
  readonly params: Promise<{ readonly name: string }>
}

export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params
  const { byName } = await loadManifests()
  const m = byName.get(name)
  if (!m) return { title: "Not found" }
  return {
    title: `${m.name}`,
    description: m.description,
    alternates: { canonical: `https://hyperjs.ai/c/${m.name}` },
  }
}

export async function generateStaticParams(): Promise<{ name: string }[]> {
  const { components } = await loadManifests()
  return components.map((c) => ({ name: c.name }))
}

export default async function ComponentPage({ params }: PageProps) {
  const { name } = await params
  const { byName } = await loadManifests()
  const m = byName.get(name)
  if (!m) notFound()

  const readmeHtml = m.readme ? renderMarkdown(m.readme) : ""

  const peerDeps = Object.entries(m.peerDeps)
  const optionalPeers = Object.entries(m.optionalPeerDeps)
  const envVars = Object.entries(m.envVars ?? {})

  return (
    <main>
      <Letterhead />

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h1 className="h-doc h-doc-1 mb-6">{m.name.toUpperCase()}</h1>
        <div className="space-y-5 text-[13px] leading-[1.7]">
          <p>
            <span className="text-[var(--color-fg-muted)]">v{m.version}</span>
            {" — "}
            {m.description}
          </p>
        </div>

        <div className="mt-6 border border-[var(--color-line)] bg-[var(--color-bg-deep)] px-4 py-2 font-mono text-[12px]">
          $ hyper add {m.name}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-fg-muted)]">
          Copies {m.files.length} file
          {m.files.length === 1 ? "" : "s"} into{" "}
          <span className="ic">src/hyper/{m.name}/</span> and updates{" "}
          <span className="ic">hyper.lock.json</span>.
        </p>
      </section>

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h2 className="h-doc h-doc-2 mb-4">DEPS</h2>
        <ul className="space-y-1 text-[13px]">
          <li>
            <span className="text-[var(--color-fg-muted)]">registry:</span>{" "}
            {m.registryDeps.length === 0 ? (
              <span className="text-[var(--color-fg-subtle)]">none</span>
            ) : (
              m.registryDeps.map((d, i) => (
                <span key={d}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/c/${d}`}>
                    <span className="ic">{d}</span>
                  </Link>
                </span>
              ))
            )}
          </li>
          {peerDeps.length > 0 ? (
            <li>
              <span className="text-[var(--color-fg-muted)]">peers:</span>{" "}
              {peerDeps.map(([k, v], i) => (
                <span key={k}>
                  {i > 0 ? ", " : ""}
                  <span className="ic">
                    {k}@{v}
                  </span>
                </span>
              ))}
            </li>
          ) : null}
          {optionalPeers.length > 0 ? (
            <li>
              <span className="text-[var(--color-fg-muted)]">optional:</span>{" "}
              {optionalPeers.map(([k, v], i) => (
                <span key={k}>
                  {i > 0 ? ", " : ""}
                  <span className="ic">
                    {k}@{v}
                  </span>
                </span>
              ))}
            </li>
          ) : null}
          {envVars.length > 0 ? (
            <li>
              <span className="text-[var(--color-fg-muted)]">env:</span>{" "}
              {envVars.map(([k], i) => (
                <span key={k}>
                  {i > 0 ? ", " : ""}
                  <span className="ic">{k}</span>
                </span>
              ))}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h2 className="h-doc h-doc-2 mb-4">FILES</h2>
        <ul className="space-y-1 font-mono text-[12px]">
          {m.files.map((f) => (
            <li key={f.path}>{f.target ? `${f.path} → ${f.target}` : f.path}</li>
          ))}
        </ul>
      </section>

      {readmeHtml ? (
        <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
          <h2 className="h-doc h-doc-2 mb-4">README</h2>
          {/* Rendered markdown — sourced from the component's README in the
              monorepo, sanitized via our minimal renderer. */}
          <div
            className="md"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted source
            dangerouslySetInnerHTML={{ __html: readmeHtml }}
          />
        </section>
      ) : null}

      <section className="mx-auto max-w-[860px] border-t border-[var(--color-line)] px-6 py-12 sm:px-10">
        <h2 className="h-doc h-doc-2 mb-4">MANIFEST</h2>
        <ul className="space-y-1 text-[13px]">
          <li>
            <Link href={`/r/${m.name}.json`}>
              <span className="ic">/r/{m.name}.json</span>
            </Link>{" "}
            <span className="text-[var(--color-fg-muted)]">— latest</span>
          </li>
          <li>
            <Link href={`/r/${m.name}@${m.version}.json`}>
              <span className="ic">
                /r/{m.name}@{m.version}.json
              </span>
            </Link>{" "}
            <span className="text-[var(--color-fg-muted)]">— immutable</span>
          </li>
        </ul>
      </section>

      <Footer />
    </main>
  )
}
