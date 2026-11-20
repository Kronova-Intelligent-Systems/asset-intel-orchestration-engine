import type { Criticality, IoTAlert, IoTDevice, ProximitySettlement } from "./types"

export const STALE_HEARTBEAT_SECONDS = 300

export function secondsSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
}

export function formatTimeAgo(iso: string | null, now = Date.now()): string {
  const seconds = secondsSince(iso, now)
  if (seconds === null) return "never"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function isStaleHeartbeat(device: IoTDevice, now = Date.now()): boolean {
  if (device.status !== "online") return false
  const seconds = secondsSince(device.lastSeen, now)
  return seconds === null || seconds > STALE_HEARTBEAT_SECONDS
}

export function isOpenAlert(alert: IoTAlert): boolean {
  return alert.resolvedAt === null
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.split(".").map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function latestFirmware(devices: IoTDevice[]): string | null {
  const versions = devices.map((d) => d.firmware).filter((v): v is string => Boolean(v))
  if (versions.length === 0) return null
  return versions.reduce((latest, v) => (compareVersions(v, latest) > 0 ? v : latest))
}

export function percent(part: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((part / total) * 1000) / 10
}

export interface FleetMetrics {
  total: number
  online: number
  offline: number
  alert: number
  maintenance: number
  inactive: number
  availability: number | null
  staleHeartbeats: number
  openAlerts: number
  openCritical: number
  openWarning: number
  openInfo: number
  attestedPercent: number | null
  maintenanceDue: number
}

export function computeFleetMetrics(devices: IoTDevice[], alerts: IoTAlert[], now = Date.now()): FleetMetrics {
  const count = (status: IoTDevice["status"]) => devices.filter((d) => d.status === status).length
  const openAlerts = alerts.filter(isOpenAlert)
  const known = devices.filter((d) => d.attested !== null)
  const inService = devices.filter((d) => d.status !== "inactive")

  return {
    total: devices.length,
    online: count("online"),
    offline: count("offline"),
    alert: count("alert"),
    maintenance: count("maintenance"),
    inactive: count("inactive"),
    availability: percent(count("online"), inService.length),
    staleHeartbeats: devices.filter((d) => isStaleHeartbeat(d, now)).length,
    openAlerts: openAlerts.length,
    openCritical: openAlerts.filter((a) => a.severity === "critical").length,
    openWarning: openAlerts.filter((a) => a.severity === "warning").length,
    openInfo: openAlerts.filter((a) => a.severity === "info").length,
    attestedPercent: percent(known.filter((d) => d.attested).length, known.length),
    maintenanceDue: devices.filter((d) => d.maintenanceStatus && d.maintenanceStatus !== "good").length,
  }
}

export interface SiteSummary {
  site: string
  criticality: Criticality
  devices: number
  online: number
  openAlerts: number
  worstSeverity: "critical" | "warning" | "info" | null
}

export function computeSiteSummaries(devices: IoTDevice[], alerts: IoTAlert[]): SiteSummary[] {
  const bySite = new Map<string, IoTDevice[]>()
  for (const device of devices) {
    const list = bySite.get(device.site) ?? []
    list.push(device)
    bySite.set(device.site, list)
  }

  const open = alerts.filter(isOpenAlert)
  const tierOrder: Record<Criticality, number> = { tier0: 0, tier1: 1, tier2: 2, unclassified: 3 }

  return Array.from(bySite.entries())
    .map(([site, list]) => {
      const ids = new Set(list.map((d) => d.id))
      const siteAlerts = open.filter((a) => a.deviceId && ids.has(a.deviceId))
      const worstSeverity = siteAlerts.some((a) => a.severity === "critical")
        ? ("critical" as const)
        : siteAlerts.some((a) => a.severity === "warning")
          ? ("warning" as const)
          : siteAlerts.length > 0
            ? ("info" as const)
            : null
      return {
        site,
        criticality: list[0].criticality,
        devices: list.length,
        online: list.filter((d) => d.status === "online").length,
        openAlerts: siteAlerts.length,
        worstSeverity,
      }
    })
    .sort((a, b) => tierOrder[a.criticality] - tierOrder[b.criticality] || a.site.localeCompare(b.site))
}

export type CheckState = "pass" | "warn" | "fail" | "unknown"

export interface PostureCheck {
  id: string
  label: string
  description: string
  state: CheckState
  value: string
}

function gradePercent(value: number | null, pass: number, warn: number): CheckState {
  if (value === null) return "unknown"
  if (value >= pass) return "pass"
  if (value >= warn) return "warn"
  return "fail"
}

export function computePostureChecks(devices: IoTDevice[], alerts: IoTAlert[], now = Date.now()): PostureCheck[] {
  const critical = devices.filter(
    (d) => (d.criticality === "tier0" || d.criticality === "tier1") && d.status !== "inactive",
  )
  const criticalIds = new Set(critical.map((d) => d.id))
  const open = alerts.filter((a) => isOpenAlert(a) && a.deviceId && criticalIds.has(a.deviceId))

  const fresh = percent(
    critical.filter((d) => {
      const seconds = secondsSince(d.lastSeen, now)
      return seconds !== null && seconds <= STALE_HEARTBEAT_SECONDS
    }).length,
    critical.length,
  )

  const latest = latestFirmware(critical)
  const current = percent(critical.filter((d) => d.firmware !== null && d.firmware === latest).length, critical.length)

  const attestable = critical.filter((d) => d.attested !== null)
  const attested = percent(attestable.filter((d) => d.attested).length, attestable.length)

  const openCritical = open.filter((a) => a.severity === "critical").length
  const unacknowledged = open.filter((a) => {
    const seconds = secondsSince(a.triggeredAt, now)
    return a.acknowledgedAt === null && seconds !== null && seconds > 900 && a.severity !== "info"
  }).length
  const overdue = critical.filter((d) => d.maintenanceStatus === "overdue" || d.maintenanceStatus === "critical").length

  const fmt = (v: number | null) => (v === null ? "No data" : `${v}%`)

  return [
    {
      id: "heartbeat",
      label: "Heartbeat freshness",
      description: "Tier 0 and Tier 1 devices reporting within the last 5 minutes.",
      state: gradePercent(fresh, 98, 90),
      value: fmt(fresh),
    },
    {
      id: "firmware",
      label: "Firmware currency",
      description: latest ? `Tier 0 and Tier 1 devices on the newest version in use (${latest}).` : "No firmware versions reported.",
      state: gradePercent(current, 95, 80),
      value: fmt(current),
    },
    {
      id: "attestation",
      label: "Device identity attestation",
      description: "Tier 0 and Tier 1 devices with a verified cryptographic identity.",
      state: gradePercent(attested, 99, 95),
      value: fmt(attested),
    },
    {
      id: "critical-alerts",
      label: "Open critical alerts",
      description: "Unresolved critical alerts on Tier 0 and Tier 1 devices.",
      state: openCritical === 0 ? "pass" : "fail",
      value: String(openCritical),
    },
    {
      id: "unacknowledged",
      label: "Unacknowledged alerts",
      description: "Warning or critical alerts open for more than 15 minutes without acknowledgement.",
      state: unacknowledged === 0 ? "pass" : unacknowledged <= 2 ? "warn" : "fail",
      value: String(unacknowledged),
    },
    {
      id: "maintenance",
      label: "Maintenance backlog",
      description: "Tier 0 and Tier 1 devices that are overdue or in critical maintenance state.",
      state: overdue === 0 ? "pass" : overdue <= 2 ? "warn" : "fail",
      value: String(overdue),
    },
  ]
}

export interface TierSummary {
  tier: Criticality
  devices: number
  online: number
  openAlerts: number
  staleHeartbeats: number
}

export function computeTierSummaries(devices: IoTDevice[], alerts: IoTAlert[], now = Date.now()): TierSummary[] {
  const tiers: Criticality[] = ["tier0", "tier1", "tier2", "unclassified"]
  const open = alerts.filter(isOpenAlert)
  return tiers
    .map((tier) => {
      const list = devices.filter((d) => d.criticality === tier)
      const ids = new Set(list.map((d) => d.id))
      return {
        tier,
        devices: list.length,
        online: list.filter((d) => d.status === "online").length,
        openAlerts: open.filter((a) => a.deviceId && ids.has(a.deviceId)).length,
        staleHeartbeats: list.filter((d) => isStaleHeartbeat(d, now)).length,
      }
    })
    .filter((t) => t.devices > 0)
}

export interface SettlementSummary {
  total: number
  finalized: number
  queued: number
  signed: number
  rejected: number
  offlineOriginated: number
  medianFinalizeSeconds: number | null
}

export function computeSettlementSummary(settlements: ProximitySettlement[]): SettlementSummary {
  const durations = settlements
    .filter((s) => s.status === "finalized" && s.finalizedAt)
    .map((s) => (new Date(s.finalizedAt as string).getTime() - new Date(s.signedAt).getTime()) / 1000)
    .sort((a, b) => a - b)
  const median = durations.length === 0 ? null : durations[Math.floor(durations.length / 2)]

  return {
    total: settlements.length,
    finalized: settlements.filter((s) => s.status === "finalized").length,
    queued: settlements.filter((s) => s.status === "queued").length,
    signed: settlements.filter((s) => s.status === "signed").length,
    rejected: settlements.filter((s) => s.status === "rejected").length,
    offlineOriginated: settlements.filter((s) => s.offline).length,
    medianFinalizeSeconds: median,
  }
}
