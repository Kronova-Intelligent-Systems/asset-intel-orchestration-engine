export type DeviceClass = "vehicle" | "trailer" | "container" | "sensor" | "gateway" | "camera"
export type DeviceStatus = "online" | "offline" | "maintenance" | "alert" | "inactive"
export type Criticality = "tier0" | "tier1" | "tier2" | "unclassified"
export type LinkType = "cellular" | "ble" | "satellite" | "lora" | "wired" | "unknown"
export type MaintenanceStatus = "good" | "attention" | "critical" | "overdue"
export type AlertSeverity = "info" | "warning" | "critical"

export interface IoTDevice {
  id: string
  name: string
  deviceClass: DeviceClass
  status: DeviceStatus
  site: string
  criticality: Criticality
  link: LinkType
  lastSeen: string | null
  firmware: string | null
  maintenanceStatus: MaintenanceStatus | null
  nextMaintenance: string | null
  batteryPercent: number | null
  attested: boolean | null
}

export interface IoTAlert {
  id: string
  deviceId: string | null
  deviceName: string
  type: string
  severity: AlertSeverity
  title: string
  message: string
  triggeredAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

export type SampleReason = "empty" | "unavailable"

export interface IoTSnapshot {
  devices: IoTDevice[]
  alerts: IoTAlert[]
  isSample: boolean
  sampleReason: SampleReason | null
}

export type SettlementStatus = "signed" | "queued" | "finalized" | "rejected"

export interface ProximitySettlement {
  id: string
  initiator: string
  counterparty: string
  amount: number
  status: SettlementStatus
  signedAt: string
  finalizedAt: string | null
  offline: boolean
  rejectionReason: string | null
}

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  tier0: "Tier 0",
  tier1: "Tier 1",
  tier2: "Tier 2",
  unclassified: "Unclassified",
}

export const CRITICALITY_DESCRIPTION: Record<Criticality, string> = {
  tier0: "Safety-critical",
  tier1: "Mission-critical",
  tier2: "Operational",
  unclassified: "Not yet classified",
}

export const CLASS_LABEL: Record<DeviceClass, string> = {
  vehicle: "Vehicle",
  trailer: "Trailer",
  container: "Container",
  sensor: "Sensor",
  gateway: "Gateway",
  camera: "Camera",
}

export const LINK_LABEL: Record<LinkType, string> = {
  cellular: "Cellular",
  ble: "Bluetooth LE",
  satellite: "Satellite",
  lora: "LoRa",
  wired: "Wired",
  unknown: "Unknown",
}

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  maintenance: "Maintenance",
  alert: "Alert",
  inactive: "Inactive",
}
