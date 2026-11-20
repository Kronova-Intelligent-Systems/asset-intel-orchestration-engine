"use client"

import { useMemo } from "react"
import { Activity, AlertTriangle, BadgeCheck, HeartPulse, Layers, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeFleetMetrics,
  computeSiteSummaries,
  formatTimeAgo,
  isOpenAlert,
  type FleetMetrics,
} from "@/lib/iot/metrics"
import type { DeviceStatus, IoTSnapshot } from "@/lib/iot/types"
import { STATUS_LABEL } from "@/lib/iot/types"
import { SectionCard, SectionHeader, SeverityBadge, STATUS_DOT, TierBadge } from "./iot-ui"

const STATUS_ORDER: DeviceStatus[] = ["online", "alert", "maintenance", "offline", "inactive"]

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  tone?: "default" | "warn" | "bad"
}) {
  return (
    <SectionCard className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums text-foreground",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </SectionCard>
  )
}

function StatusMix({ metrics }: { metrics: FleetMetrics }) {
  const counts: Record<DeviceStatus, number> = {
    online: metrics.online,
    alert: metrics.alert,
    maintenance: metrics.maintenance,
    offline: metrics.offline,
    inactive: metrics.inactive,
  }

  return (
    <SectionCard>
      <SectionHeader title="Fleet status" description="Current state of every registered device" />
      <div className="space-y-4 p-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Device status distribution">
          {STATUS_ORDER.map((status) =>
            counts[status] > 0 ? (
              <div
                key={status}
                className={STATUS_DOT[status]}
                style={{ width: `${(counts[status] / Math.max(metrics.total, 1)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
                {STATUS_LABEL[status]}
              </span>
              <span className="font-medium tabular-nums text-foreground">{counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  )
}

export function OverviewTab({ snapshot }: { snapshot: IoTSnapshot }) {
  const { devices, alerts } = snapshot
  const metrics = useMemo(() => computeFleetMetrics(devices, alerts), [devices, alerts])
  const sites = useMemo(() => computeSiteSummaries(devices, alerts), [devices, alerts])
  const openAlerts = useMemo(() => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return alerts
      .filter(isOpenAlert)
      .sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
      .slice(0, 6)
  }, [alerts])
  const maintenance = useMemo(() => {
    const rank = { overdue: 0, critical: 1, attention: 2, good: 3 }
    return devices
      .filter((d) => d.maintenanceStatus && d.maintenanceStatus !== "good")
      .sort((a, b) => rank[a.maintenanceStatus!] - rank[b.maintenanceStatus!])
      .slice(0, 6)
  }, [devices])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Layers} label="Devices" value={String(metrics.total)} hint={`${sites.length} sites`} />
        <Kpi
          icon={Activity}
          label="Availability"
          value={metrics.availability === null ? "No data" : `${metrics.availability}%`}
          hint="Online of in-service"
          tone={metrics.availability !== null && metrics.availability < 90 ? "warn" : "default"}
        />
        <Kpi
          icon={AlertTriangle}
          label="Open alerts"
          value={String(metrics.openAlerts)}
          hint={`${metrics.openCritical} critical`}
          tone={metrics.openCritical > 0 ? "bad" : "default"}
        />
        <Kpi
          icon={HeartPulse}
          label="Stale heartbeats"
          value={String(metrics.staleHeartbeats)}
          hint="Online, silent over 5 min"
          tone={metrics.staleHeartbeats > 0 ? "warn" : "default"}
        />
        <Kpi
          icon={BadgeCheck}
          label="Attested"
          value={metrics.attestedPercent === null ? "No data" : `${metrics.attestedPercent}%`}
          hint="Verified device identity"
        />
        <Kpi
          icon={Wrench}
          label="Maintenance due"
          value={String(metrics.maintenanceDue)}
          hint="Needs attention or overdue"
          tone={metrics.maintenanceDue > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <StatusMix metrics={metrics} />

          <SectionCard>
            <SectionHeader title="Sites" description="Health by location, most critical first" />
            <ul className="divide-y divide-border">
              {sites.map((site) => (
                <li key={site.site} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{site.site}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <TierBadge tier={site.criticality} />
                      <span className="text-xs text-muted-foreground">{site.devices} devices</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-28">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">Online</span>
                        <span className="tabular-nums text-foreground">
                          {site.online}/{site.devices}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(site.online / Math.max(site.devices, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    {site.worstSeverity ? (
                      <SeverityBadge severity={site.worstSeverity} />
                    ) : (
                      <span className="w-[4.5rem] text-xs text-muted-foreground">No alerts</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <SectionHeader title="Open alerts" description="Critical first" />
            {openAlerts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No open alerts.</p>
            ) : (
              <ul className="divide-y divide-border">
                {openAlerts.map((alert) => (
                  <li key={alert.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(alert.triggeredAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{alert.deviceName}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeader title="Maintenance watchlist" description="Devices that need service" />
            {maintenance.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing due.</p>
            ) : (
              <ul className="divide-y divide-border">
                {maintenance.map((device) => (
                  <li key={device.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-foreground">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.nextMaintenance ? `Due ${device.nextMaintenance}` : "No date set"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        device.maintenanceStatus === "overdue" || device.maintenanceStatus === "critical"
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {device.maintenanceStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
