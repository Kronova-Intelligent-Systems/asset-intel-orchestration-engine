import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import localFont from "next/font/local"
import { ClientProviders } from "@/components/client-providers"
import { ConditionalSiteHeader } from "@/components/conditional-site-header"
import { ConditionalFooter } from "@/components/conditional-footer"
import { cn } from "@/lib/utils"
import { FeedbackProvider } from "@/components/feedback/feedback-provider"
import { Analytics } from "@vercel/analytics/react"
import { getVersion } from "@/lib/version"
import { UnifiedFAB } from "@/components/support/unified-fab"

export const dynamic = "force-dynamic"

// Self-hosted as local files instead of next/font/google: both are single
// variable-font woff2 files (Google now serves the same file for every
// static weight request), downloaded once from Google Fonts and committed
// under app/fonts/. This removes the network fetch to fonts.googleapis.com
// at build time, which was intermittently failing deploys with a
// "Module not found" error on the generated font module.css.
const eczar = localFont({
  src: "./fonts/Eczar-Variable.woff2",
  weight: "400 800",
  variable: "--font-eczar",
})
const robotoCondensed = localFont({
  src: "./fonts/RobotoCondensed-Variable.woff2",
  weight: "300 700",
  variable: "--font-roboto-condensed",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://app.kronova.io"),
  alternates: {
    canonical: "https://app.kronova.io",
  },
  title: {
    default: "Kronova Intelligent Systems",
    template: "%s | Kronova",
  },
  description:
    "Kronova Asset Intelligence and Orchestration Platform is an open-source AI orchestration engine. Sign up and use it for free, fork the codebase, and connect production workloads to AetherNet QUAS and KVS for sovereign, post-quantum-secure execution.",
  generator: `app.kronova.io v${getVersion().appVersion}`,
  manifest: "/manifest.json",
  applicationName: "Kronova",
  appleWebApp: {
    capable: true,
    title: "Kronova",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Kronova Intelligent Systems",
    title: {
      default: "Kronova Intelligent Systems",
      template: "%s | Kronova",
    },
    description:
      "Open-source AI asset intelligence and orchestration. Use Kronova for free, fork the codebase, and connect to AetherNet QUAS and KVS for sovereign, post-quantum-secure execution.",
    url: "https://app.kronova.io",
    images: [
      {
        url: "/images/landing/aether-ecosystem-hero.png",
        width: 1200,
        height: 630,
        alt: "Kronova - Intelligent Systems",
        type: "image/png",
      },
      {
        url: "/images/landing/hero-platform-preview.png",
        width: 1200,
        height: 630,
        alt: "Kronova Platform Preview - AI Business Suite",
        type: "image/png",
      },
      {
        url: "/images/landing/feature-ai-agent-network.png",
        width: 1200,
        height: 630,
        alt: "AetherNet - Secure AI Agent Network",
        type: "image/png",
      },
      {
        url: "/images/landing/feature-blockchain-integration.png",
        width: 1200,
        height: 630,
        alt: "AetherChain - High-Performance Rust Blockchain",
        type: "image/png",
      },
      {
        url: "/images/landing/resendit-optimization-engine.png",
        width: 1200,
        height: 630,
        alt: "Kronova Optimization Engine - ROI and Sustainability Metrics",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: "Kronova Intelligent Systems",
      template: "%s | Kronova",
    },
    description:
      "Open-source AI asset intelligence and orchestration. Use Kronova for free, fork the codebase, and connect to AetherNet QUAS and KVS for sovereign, post-quantum-secure execution.",
    images: [
      {
        url: "/images/landing/aether-ecosystem-hero.png",
        alt: "Kronova - ",
      },
    ],
    creator: "@KronovaAI",
    site: "@KronovaAI",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      // Modern browsers: SVG scales perfectly at any resolution
      {
        url: "https://quantumone.b-cdn.net/kronova/kronova-svg-icon.svg",
        type: "image/svg+xml",
      },
      // Legacy fallback: 256x256 ICO covers 16, 32, 48, 256 in one file
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      // Explicit PNG for platforms that prefer raster over SVG
      {
        url: "/icons/kronova-icon-300x300.png",
        sizes: "300x300",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: [
      // Apple Touch Icon — 180x180 is the canonical size for iOS home screen
      {
        url: "/icons/kronova-icon-300x300.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      // Android / Chrome maskable icon
      {
        rel: "mask-icon",
        url: "https://quantumone.b-cdn.net/kronova/kronova-svg-icon.svg",
        color: "#0047AB",
      },
    ],
  },
  verification: {},
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn("min-h-screen bg-background font-sans antialiased", eczar.variable, robotoCondensed.variable)}
      >
        <ClientProviders>
          <FeedbackProvider>
            <div className="relative flex min-h-screen flex-col">
              <ConditionalSiteHeader />
              <main className="flex-1">{children}</main>
              <ConditionalFooter />
            </div>
            <UnifiedFAB />
          </FeedbackProvider>
        </ClientProviders>
        <Analytics />
      </body>
    </html>
  )
}
