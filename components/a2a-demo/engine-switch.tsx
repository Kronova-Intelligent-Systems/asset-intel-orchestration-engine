"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import type { EngineId } from "@/lib/aethernet-demo/types"
import { PILOT_COPY } from "@/lib/pilot/config"
import { PilotDialog } from "./pilot-dialog"

interface EngineSwitchProps {
  engine: EngineId
  onEngineChange: (engine: EngineId) => void
  disabled?: boolean
}

const fetchReady = async (url: string): Promise<boolean> => {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) return false
  const body = (await response.json()) as { ready?: boolean }
  return body.ready === true
}

/**
 * Selects the engine behind the QUAS and KVS steps. Without provisioned access the switch slides across, then settles
 * back while the pilot dialog opens, so the capability is visible without any claim about its availability.
 */
export function EngineSwitch({ engine, onEngineChange, disabled }: EngineSwitchProps) {
  const { data: ready = false } = useSWR("/api/v1/aethernet-demo/engine", fetchReady, { revalidateOnFocus: false })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [slid, setSlid] = useState(false)

  useEffect(() => {
    if (!ready && engine === "aethernet") onEngineChange("standin")
  }, [ready, engine, onEngineChange])

  useEffect(() => {
    if (!slid) return
    const timer = window.setTimeout(() => setDialogOpen(true), 350)
    return () => window.clearTimeout(timer)
  }, [slid])

  const handleChange = (checked: boolean) => {
    if (!checked) return onEngineChange("standin")
    if (ready) return onEngineChange("aethernet")
    setSlid(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setSlid(false)
  }

  const active = engine === "aethernet"

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3 sm:p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="engine-switch" className="text-sm font-semibold text-foreground">
            {PILOT_COPY.toggleLabel}
          </label>
          <Badge variant={active ? "default" : "outline"} className="px-1.5 py-0 text-[11px] font-medium">
            {active ? "Attested enclave" : "Demo engine"}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{PILOT_COPY.toggleDescription}</p>
      </div>
      <Switch
        id="engine-switch"
        checked={active || slid}
        onCheckedChange={handleChange}
        disabled={disabled}
        aria-haspopup={ready ? undefined : "dialog"}
        className="mt-0.5 shrink-0"
      />
      <PilotDialog open={dialogOpen} onOpenChange={handleDialogChange} />
    </div>
  )
}
