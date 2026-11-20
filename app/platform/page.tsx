import type { Metadata } from "next"
import { PlatformAudiences } from "@/components/platform/platform-audiences"
import { PlatformCapabilities } from "@/components/platform/platform-capabilities"
import { PlatformHero } from "@/components/platform/platform-hero"
import { PlatformClosingCta, PlatformPathway } from "@/components/platform/platform-pathway"

export const metadata: Metadata = {
  title: "The AI Business Suite: what you can do | Kronova",
  description:
    "A free reference platform for building and governing AI agents. Run agents and workflows, search your own data, connect assets and watch agents settle a deal, then see the path to AetherNet QUAS and KVS.",
}

export default function PlatformPage() {
  return (
    <main>
      <PlatformHero />
      <PlatformCapabilities />
      <PlatformAudiences />
      <PlatformPathway />
      <PlatformClosingCta />
    </main>
  )
}
