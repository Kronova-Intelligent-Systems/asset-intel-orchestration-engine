import type { Metadata } from "next"
import { A2ADemo } from "@/components/a2a-demo/a2a-demo"

export const metadata: Metadata = {
  title: "Live A2A Settlement Demo - AI Business Suite",
  description:
    "Two AI agents negotiate and settle a purchase order over post-quantum sealed A2A messages, with IoT-verified delivery and deterministic mandate enforcement",
}

export default function A2ADemoPage() {
  return <A2ADemo />
}
