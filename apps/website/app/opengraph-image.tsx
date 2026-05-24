import { ImageResponse } from "next/og"

export const alt = "Hyper — an API framework for Bun, distributed as source"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const BG = "#2a2bd5"
const FG = "#ffffff"

/**
 * OG / Twitter card.
 *
 * Solid Hyper-blue background with the wordmark centred and rendered as a
 * stroke-only outline. Satori (which powers `next/og`) drops glyphs entirely
 * when `color` is `transparent`, so we paint the fill in the background colour
 * — it disappears against the bg and only the white stroke remains visible.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 360,
            fontWeight: 900,
            letterSpacing: -12,
            color: BG,
            WebkitTextStrokeColor: FG,
            WebkitTextStrokeWidth: 3,
          }}
        >
          hyper
        </div>
      </div>
    ),
    { ...size },
  )
}
