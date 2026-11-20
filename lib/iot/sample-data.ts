import type {
  AlertSeverity,
  Criticality,
  DeviceClass,
  DeviceStatus,
  IoTAlert,
  IoTDevice,
  LinkType,
  MaintenanceStatus,
  ProximitySettlement,
} from "./types"

function createRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SiteSpec {
  name: string
  code: string
  criticality: Criticality
  classes: Partial<Record<DeviceClass, number>>
}

const SITES: SiteSpec[] = [
  { name: "Substation N-12", code: "N12", criticality: "tier0", classes: { sensor: 5, gateway: 2, camera: 1 } },
  { name: "Water Treatment 2", code: "WT2", criticality: "tier0", classes: { sensor: 5, gateway: 2 } },
  { name: "Control Centre A", code: "CCA", criticality: "tier1", classes: { gateway: 3, sensor: 3, camera: 2 } },
  { name: "Pipeline Station 14", code: "PS14", criticality: "tier1", classes: { sensor: 4, gateway: 2, camera: 1 } },
  {
    name: "Rail Yard East",
    code: "RYE",
    criticality: "tier1",
    classes: { container: 3, trailer: 2, sensor: 2, gateway: 1 },
  },
  {
    name: "Regional Depot",
    code: "RDP",
    criticality: "tier2",
    classes: { vehicle: 6, trailer: 2, gateway: 1, camera: 1 },
  },
]

const CLASS_PREFIX: Record<DeviceClass, string> = {
  sensor: "SNS",
  gateway: "GWY",
  camera: "CAM",
  container: "CNT",
  trailer: "TRL",
  vehicle: "VEH",
}

const FIRMWARE_VERSIONS = ["4.2.1", "4.2.1", "4.2.1", "4.2.0", "4.1.9"]

function pickLink(deviceClass: DeviceClass, rng: () => number): LinkType {
  const roll = rng()
  switch (deviceClass) {
    case "sensor":
      return roll < 0.55 ? "ble" : roll < 0.85 ? "lora" : "wired"
    case "gateway":
      return roll < 0.5 ? "wired" : roll < 0.9 ? "cellular" : "satellite"
    case "camera":
      return "wired"
    default:
      return roll < 0.7 ? "cellular" : roll < 0.9 ? "ble" : "satellite"
  }
}

function pickStatus(criticality: Criticality, rng: () => number): DeviceStatus {
  const roll = rng()
  const failureScale = criticality === "tier0" ? 0.5 : 1
  if (roll < 0.04 * failureScale) return "alert"
  if (roll < 0.09 * failureScale) return "offline"
  if (roll < 0.14 * failureScale) return "maintenance"
  if (roll < 0.16) return "inactive"
  return "online"
}

function pickMaintenance(rng: () => number): MaintenanceStatus {
  const roll = rng()
  if (roll < 0.7) return "good"
  if (roll < 0.88) return "attention"
  if (roll < 0.93) return "critical"
  return "overdue"
}

function secondsAgo(now: number, seconds: number) {
  return new Date(now - seconds * 1000).toISOString()
}

export function generateSampleDevices(now = Date.now()): IoTDevice[] {
  const rng = createRng(20260611)
  const devices: IoTDevice[] = []

  for (const site of SITES) {
    for (const [deviceClass, count] of Object.entries(site.classes) as [DeviceClass, number][]) {
      for (let i = 1; i <= count; i++) {
        const status = pickStatus(site.criticality, rng)
        const maintenanceStatus = pickMaintenance(rng)
        const staleHeartbeat = status === "online" && rng() < 0.06

        let lastSeenSeconds: number
        if (status === "online") lastSeenSeconds = staleHeartbeat ? 400 + rng() * 400 : rng() * 90
        else if (status === "alert") lastSeenSeconds = rng() * 120
        else if (status === "maintenance") lastSeenSeconds = 600 + rng() * 3000
        else if (status === "offline") lastSeenSeconds = 900 + rng() * 20000
        else lastSeenSeconds = 86400 * (2 + rng() * 10)

        const hasBattery = deviceClass === "sensor" || deviceClass === "container" || deviceClass === "trailer"
        const attestedChance = site.criticality === "tier2" ? 0.8 : 0.96
        const nextMaintenanceDays =
          maintenanceStatus === "overdue" ? -Math.ceil(rng() * 20) : Math.ceil(rng() * 90) + 3

        devices.push({
          id: `sample-${site.code}-${deviceClass}-${i}`,
          name: `${CLASS_PREFIX[deviceClass]}-${site.code}-${String(i).padStart(2, "0")}`,
          deviceClass,
          status,
          site: site.name,
          criticality: site.criticality,
          link: pickLink(deviceClass, rng),
          lastSeen: secondsAgo(now, lastSeenSeconds),
          firmware: FIRMWARE_VERSIONS[Math.floor(rng() * FIRMWARE_VERSIONS.length)],
          maintenanceStatus,
          nextMaintenance: new Date(now + nextMaintenanceDays * 86400000).toISOString().slice(0, 10),
          batteryPercent: hasBattery ? Math.round(15 + rng() * 85) : null,
          attested: rng() < attestedChance,
        })
      }
    }
  }

  return devices
}

const ALERT_TEMPLATES: { type: string; severity: AlertSeverity; title: string; message: string }[] = [
  {
    type: "security",
    severity: "critical",
    title: "Enclosure tamper detected",
    message: "Tamper switch opened outside a scheduled maintenance window.",
  },
  {
    type: "diagnostic",
    severity: "warning",
    title: "Sensor drift beyond tolerance",
    message: "Readings deviate from the reference sensor by more than the calibrated threshold.",
  },
  {
    type: "temperature",
    severity: "critical",
    title: "Temperature above safe limit",
    message: "Measured temperature exceeded the configured limit for three consecutive samples.",
  },
  {
    type: "maintenance",
    severity: "warning",
    title: "Maintenance window overdue",
    message: "Scheduled maintenance has not been recorded for this device.",
  },
  {
    type: "geofence",
    severity: "warning",
    title: "Left authorised zone",
    message: "Device position is outside its assigned geofence.",
  },
]

export function generateSampleAlerts(devices: IoTDevice[], now = Date.now()): IoTAlert[] {
  const rng = createRng(77013)
  const alerts: IoTAlert[] = []
  let n = 0

  for (const device of devices) {
    const needsAlert = device.status === "alert"
    const lostHeartbeat =
      device.status === "offline" && (device.criticality === "tier0" || device.criticality === "tier1")
    if (!needsAlert && !lostHeartbeat) continue

    n += 1
    if (needsAlert) {
      const template = ALERT_TEMPLATES[Math.floor(rng() * ALERT_TEMPLATES.length)]
      const triggeredSecondsAgo = 120 + rng() * 5400
      alerts.push({
        id: `sample-alert-${n}`,
        deviceId: device.id,
        deviceName: device.name,
        ...template,
        triggeredAt: secondsAgo(now, triggeredSecondsAgo),
        acknowledgedAt: rng() < 0.35 ? secondsAgo(now, triggeredSecondsAgo - 60) : null,
        resolvedAt: null,
      })
    } else {
      alerts.push({
        id: `sample-alert-${n}`,
        deviceId: device.id,
        deviceName: device.name,
        type: "diagnostic",
        severity: "warning",
        title: "Heartbeat lost",
        message: "No telemetry received within the expected interval.",
        triggeredAt: device.lastSeen ?? secondsAgo(now, 3600),
        acknowledgedAt: null,
        resolvedAt: null,
      })
    }
  }

  const resolvedSources = devices.filter((d) => d.status === "online").slice(0, 5)
  resolvedSources.forEach((device, index) => {
    const template = ALERT_TEMPLATES[(index + 1) % ALERT_TEMPLATES.length]
    const triggered = 3600 * (6 + index * 5)
    alerts.push({
      id: `sample-alert-resolved-${index}`,
      deviceId: device.id,
      deviceName: device.name,
      ...template,
      severity: "info",
      triggeredAt: secondsAgo(now, triggered),
      acknowledgedAt: secondsAgo(now, triggered - 300),
      resolvedAt: secondsAgo(now, triggered - 1800),
    })
  })

  return alerts.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
}

const REJECTION_REASONS = [
  "Signature verification failed",
  "Counterparty left proximity range",
  "Replayed intent rejected",
]

export function generateSampleSettlements(devices: IoTDevice[], now = Date.now()): ProximitySettlement[] {
  const rng = createRng(4406)
  const parties = devices.filter(
    (d) => d.status === "online" && (d.deviceClass === "vehicle" || d.deviceClass === "gateway" || d.deviceClass === "trailer"),
  )
  if (parties.length < 2) return []

  const settlements: ProximitySettlement[] = []
  for (let i = 0; i < 16; i++) {
    const a = parties[Math.floor(rng() * parties.length)]
    let b = parties[Math.floor(rng() * parties.length)]
    if (b.id === a.id) b = parties[(parties.indexOf(a) + 1) % parties.length]

    const roll = rng()
    const status = roll < 0.65 ? "finalized" : roll < 0.8 ? "queued" : roll < 0.9 ? "signed" : "rejected"
    const signedSecondsAgo = 90 + i * 540 + rng() * 300
    const offline = status === "queued" || (status === "finalized" && rng() < 0.4)

    settlements.push({
      id: `sample-stl-${String(i + 1).padStart(3, "0")}`,
      initiator: a.name,
      counterparty: b.name,
      amount: Math.round((5 + rng() * 495) * 100) / 100,
      status,
      signedAt: secondsAgo(now, signedSecondsAgo),
      finalizedAt:
        status === "finalized" ? secondsAgo(now, signedSecondsAgo - (offline ? 900 + rng() * 1800 : 4 + rng() * 10)) : null,
      offline,
      rejectionReason: status === "rejected" ? REJECTION_REASONS[Math.floor(rng() * REJECTION_REASONS.length)] : null,
    })
  }

  return settlements
}
