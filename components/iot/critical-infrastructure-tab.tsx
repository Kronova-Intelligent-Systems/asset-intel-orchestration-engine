"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Eye, Lock, ShieldCheck, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { computePostureChecks, computeTierSummaries } from "@/lib/iot/metrics"
import { CRITICALITY_DESCRIPTION, CRITICALITY_LABEL, type IoTSnapshot } from "@/lib/iot/types"
import { CheckBadge, SectionCard, SectionHeader } from "./iot-ui"

const SAFEGUARDS = [
  {
    icon: Eye,
    title: "Read-only console",
    body: "This page observes devices. It has no path to issue commands, change setpoints or push firmware.",
  },
  {
    icon: Lock,
    title: "Account-scoped data",
    body: "Devices and alerts are read through row-level security, so you only see records that belong to your account.",
  },
  {
    icon: WifiOff,
    title: "Graceful degradation",
    body: "If live data cannot be loaded, the page says so and shows labelled sample data instead of stale or empty numbers.",
  },
]

export function CriticalInfrastructureTab({ snapshot }: { snapshot: IoTSnapshot }) {
  const tiers = useMemo(() => computeTierSummaries(snapshot.devices, snapshot.alerts), [snapshot])
  const checks = useMemo(() => computePostureChecks(snapshot.devices, snapshot.alerts), [snapshot])

  return (
    <div className="space-y-6">
      <section aria-labelledby="tier-heading" className="space-y-3">
        <h2 id="tier-heading" className="text-sm font-semibold text-foreground">
          Criticality tiers
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => (
            <SectionCard key={tier.tier} className="p-4">
              <p className="text-sm font-semibold text-foreground">{CRITICALITY_LABEL[tier.tier]}</p>
              <p className="text-xs text-muted-foreground">{CRITICALITY_DESCRIPTION[tier.tier]}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Devices</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{tier.devices}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Online</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">
                    {Math.round((tier.online / tier.devices) * 100)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Open alerts</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{tier.openAlerts}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Stale</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{tier.staleHeartbeats}</dd>
                </div>
              </dl>
            </SectionCard>
          ))}
        </div>
        {snapshot.devices.some((d) => d.criticality === "unclassified") && (
          <p className="text-xs text-muted-foreground">
            Unclassified devices have no <code className="font-mono">criticality</code> set in their metadata. Set it to{" "}
            <code className="font-mono">tier0</code>, <code className="font-mono">tier1</code> or{" "}
            <code className="font-mono">tier2</code> to include them in the posture checks below.
          </p>
        )}
      </section>

      <SectionCard>
        <SectionHeader
          title="Posture for Tier 0 and Tier 1"
          description="Calculated from device telemetry and alerts. Thresholds are conservative defaults."
        />
        <ul className="divide-y divide-border">
          {checks.map((check) => (
            <li key={check.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 max-w-xl">
                <p className="text-sm font-medium text-foreground">{check.label}</p>
                <p className="text-xs text-muted-foreground">{check.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-foreground">{check.value}</span>
                <CheckBadge state={check.state} />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard>
          <SectionHeader title="Safeguards in this console" />
          <ul className="divide-y divide-border">
            {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 px-4 py-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard className="flex flex-col">
          <SectionHeader title="Tamper-evident identity and audit" />
          <div className="flex flex-1 flex-col justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              For highly sensitive infrastructure, device identity and the record of what happened should not depend on
              classical cryptography or on a single database. AetherNet QUAS provides post-quantum signed identity and
              settlement, and KVS keeps the signed state and audit trail.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link href="/ai-suite/aethernet">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Open AetherNet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
