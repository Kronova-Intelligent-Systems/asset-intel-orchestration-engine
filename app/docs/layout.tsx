import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Documentation | Kronova Platform",
  description: "Documentation, API reference and SDKs for the Kronova Asset Intelligence Platform and AetherNet",
  alternates: { canonical: "/docs" },
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-background">{children}</div>
}
