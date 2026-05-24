import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

const TITLE = "Hyper — an API framework for Bun, distributed as source"
const DESCRIPTION =
  "An HTTP framework for Bun. The CLI copies the components you want into your repo. No runtime dependency on the framework — the code is yours."

export const metadata: Metadata = {
  metadataBase: new URL("https://hyperjs.ai"),
  title: {
    default: TITLE,
    template: "%s · Hyper",
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://hyperjs.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={mono.variable}>
      <body>{children}</body>
    </html>
  )
}
