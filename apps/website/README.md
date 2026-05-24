# @hyper/website

The marketing site at [hyperjs.ai](https://hyperjs.ai). The registry app
at `apps/registry` handles `/r/*` and `/mcp` — this app handles
everything else.

- **Framework:** Next.js 15 (App Router) + React 19
- **Styling:** Tailwind CSS v4, single design token set in `app/globals.css`
- **Aesthetic:** plain text document — pure monospace, sharp corners, no
  effects, no syntax highlighting. One ticker marquee at the top is the
  only animation.
- **Font:** JetBrains Mono via `next/font` — that's it
- **JS shipped:** ~109 kB first-load (just Next.js + React)

## Develop

```
bun install
bun --filter='@hyper/website' dev
# → http://localhost:3001
```

## Build

```
bun --filter='@hyper/website' build
bun --filter='@hyper/website' start
```

The page is fully static — `next build` prerenders `/` to plain HTML, so
it deploys to any static host or behind the Vercel/registry CDN.

## Structure

```
apps/website/
├── app/
│   ├── layout.tsx       Mono font + global metadata
│   ├── globals.css      Design tokens (Tailwind v4 @theme)
│   └── page.tsx         The home page — one long mono document
└── components/
    ├── ticker.tsx       Top-of-page marquee banner
    ├── letterhead.tsx   3-line letterhead + bracketed nav links
    ├── hero.tsx         # markdown-style heading + paragraphs
    ├── code-panel.tsx   Bordered <pre>; optional callout under it
    ├── trusted-by.tsx   "~ BUILT ON: …" one-liner
    ├── closing.tsx      ASCII-art diagram + final CTA
    └── footer.tsx       Pipe-separated mono link strip
```
