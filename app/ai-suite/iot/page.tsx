import type { Metadata } from "next"
import { IoTCommandCenter } from "@/components/iot/iot-command-center"

export const metadata: Metadata = {
  title: "IoT Command Center - AI Business Suite",
  description:
    "Device health, critical infrastructure posture and Bluetooth proximity settlement across AetherNet QUAS and KVS",
}

export default function IoTPage() {
  return <IoTCommandCenter />
}
