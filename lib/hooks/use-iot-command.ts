"use client"

import useSWR from "swr"
import { getSupabaseClient } from "@/lib/supabase/client"
import { generateSampleAlerts, generateSampleDevices, generateSampleSettlements } from "@/lib/iot/sample-data"
import type {
  AlertSeverity,
  Criticality,
  DeviceClass,
  DeviceStatus,
  IoTAlert,
  IoTDevice,
  IoTSnapshot,
  LinkType,
  MaintenanceStatus,
  ProximitySettlement,
} from "@/lib/iot/types"

const DEVICE_CLASSES: DeviceClass[] = ["vehicle", "trailer", "container", "sensor", "gateway", "camera"]
const LINKS: LinkType[] = ["cellular", "ble", "satellite", "lora", "wired"]
const TIERS: Criticality[] = ["tier0", "tier1", "tier2"]

interface DeviceRow {
  id: string
  device_name: string
  device_type: string
  status: DeviceStatus
  last_seen: string | null
  current_address: string | null
  firmware_version: string | null
  maintenance_status: MaintenanceStatus | null
  next_maintenance_date: string | null
  metadata: Record<string, unknown> | null
}

interface AlertRow {
  id: string
  device_id: string | null
  alert_type: string
  severity: AlertSeverity
  title: string
  message: string
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

function readString(source: Record<string, unknown> | null, key: string): string | null {
  const value = source?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function mapDevice(row: DeviceRow): IoTDevice {
  const meta = row.metadata
  const link = readString(meta, "transport")
  const tier = readString(meta, "criticality")
  const battery = meta?.battery_percent
  const attested = meta?.attested

  return {
    id: row.id,
    name: row.device_name,
    deviceClass: DEVICE_CLASSES.includes(row.device_type as DeviceClass) ? (row.device_type as DeviceClass) : "sensor",
    status: row.status === "online" || row.status === "alert" || row.status === "maintenance" || row.status === "inactive" ? row.status : "offline",
    site: readString(meta, "site") ?? row.current_address ?? "Unassigned",
    criticality: TIERS.includes(tier as Criticality) ? (tier as Criticality) : "unclassified",
    link: LINKS.includes(link as LinkType) ? (link as LinkType) : "unknown",
    lastSeen: row.last_seen,
    firmware: row.firmware_version,
    maintenanceStatus: row.maintenance_status,
    nextMaintenance: row.next_maintenance_date,
    batteryPercent: typeof battery === "number" ? battery : null,
    attested: typeof attested === "boolean" ? attested : null,
  }
}

async function fetchSnapshot(): Promise<IoTSnapshot> {
  const supabase = getSupabaseClient()

  const [devicesResult, alertsResult] = await Promise.all([
    supabase
      .from("iot_fleet_devices")
      .select(
        "id, device_name, device_type, status, last_seen, current_address, firmware_version, maintenance_status, next_maintenance_date, metadata",
      )
      .order("device_name", { ascending: true })
      .limit(500),
    supabase
      .from("iot_fleet_alerts")
      .select("id, device_id, alert_type, severity, title, message, triggered_at, acknowledged_at, resolved_at")
      .order("triggered_at", { ascending: false })
      .limit(200),
  ])

  const sample = (reason: "empty" | "unavailable"): IoTSnapshot => {
    const devices = generateSampleDevices()
    return { devices, alerts: generateSampleAlerts(devices), isSample: true, sampleReason: reason }
  }

  if (devicesResult.error) return sample("unavailable")
  const deviceRows = (devicesResult.data ?? []) as unknown as DeviceRow[]
  if (deviceRows.length === 0) return sample("empty")

  const devices = deviceRows.map(mapDevice)
  const names = new Map(devices.map((d) => [d.id, d.name]))
  const alertRows = alertsResult.error ? [] : ((alertsResult.data ?? []) as unknown as AlertRow[])

  const alerts: IoTAlert[] = alertRows.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    deviceName: (row.device_id && names.get(row.device_id)) || "Unknown device",
    type: row.alert_type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  }))

  return { devices, alerts, isSample: false, sampleReason: null }
}

export function useIoTSnapshot() {
  return useSWR<IoTSnapshot>("iot-command-snapshot", fetchSnapshot, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  })
}

export interface SettlementFeed {
  settlements: ProximitySettlement[]
  isSample: true
}

// No read API exists yet for AetherNet QUAS/KVS settlements; replace this fetcher when one does.
async function fetchSettlements(): Promise<SettlementFeed> {
  return { settlements: generateSampleSettlements(generateSampleDevices()), isSample: true }
}

export function useProximitySettlements() {
  return useSWR<SettlementFeed>("iot-proximity-settlements", fetchSettlements, {
    refreshInterval: 30000,
  })
}
