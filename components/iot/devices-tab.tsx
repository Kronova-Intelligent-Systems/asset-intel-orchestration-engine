"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimeAgo, isStaleHeartbeat } from "@/lib/iot/metrics"
import {
  CLASS_LABEL,
  CRITICALITY_LABEL,
  LINK_LABEL,
  STATUS_LABEL,
  type DeviceClass,
  type DeviceStatus,
  type Criticality,
  type IoTDevice,
  type IoTSnapshot,
} from "@/lib/iot/types"
import { SectionCard, SeverityBadge, StatusBadge, TierBadge } from "./iot-ui"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

function DeviceSheet({
  device,
  snapshot,
  onClose,
}: {
  device: IoTDevice | null
  snapshot: IoTSnapshot
  onClose: () => void
}) {
  const alerts = device ? snapshot.alerts.filter((a) => a.deviceId === device.id).slice(0, 5) : []

  return (
    <Sheet open={device !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {device && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">{device.name}</SheetTitle>
              <SheetDescription>
                {CLASS_LABEL[device.deviceClass]} at {device.site}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <StatusBadge status={device.status} />
                </Field>
                <Field label="Criticality">
                  <TierBadge tier={device.criticality} />
                </Field>
                <Field label="Last seen">
                  {formatTimeAgo(device.lastSeen)}
                  {isStaleHeartbeat(device) && <span className="ml-1 text-xs text-amber-500">(stale)</span>}
                </Field>
                <Field label="Link">{LINK_LABEL[device.link]}</Field>
                <Field label="Firmware">{device.firmware ?? "Unknown"}</Field>
                <Field label="Battery">{device.batteryPercent === null ? "Mains / n/a" : `${device.batteryPercent}%`}</Field>
                <Field label="Identity attestation">
                  {device.attested === null ? "No data" : device.attested ? "Verified" : "Not verified"}
                </Field>
                <Field label="Maintenance">
                  <span className="capitalize">{device.maintenanceStatus ?? "No data"}</span>
                  {device.nextMaintenance && (
                    <span className="block text-xs text-muted-foreground">Next {device.nextMaintenance}</span>
                  )}
                </Field>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Recent alerts</h3>
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No alerts for this device.</p>
                ) : (
                  <ul className="space-y-2">
                    {alerts.map((alert) => (
                      <li key={alert.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <SeverityBadge severity={alert.severity} />
                          <span className="text-xs text-muted-foreground">
                            {alert.resolvedAt ? "Resolved" : "Open"} {formatTimeAgo(alert.triggeredAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function DevicesTab({ snapshot }: { snapshot: IoTSnapshot }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<DeviceStatus | "all">("all")
  const [deviceClass, setDeviceClass] = useState<DeviceClass | "all">("all")
  const [tier, setTier] = useState<Criticality | "all">("all")
  const [selected, setSelected] = useState<IoTDevice | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snapshot.devices.filter(
      (d) =>
        (status === "all" || d.status === status) &&
        (deviceClass === "all" || d.deviceClass === deviceClass) &&
        (tier === "all" || d.criticality === tier) &&
        (q === "" || d.name.toLowerCase().includes(q) || d.site.toLowerCase().includes(q)),
    )
  }, [snapshot.devices, query, status, deviceClass, tier])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices or sites"
            aria-label="Search devices or sites"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 md:flex">
          <Select value={status} onValueChange={(v) => setStatus(v as DeviceStatus | "all")}>
            <SelectTrigger aria-label="Filter by status" className="md:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as DeviceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deviceClass} onValueChange={(v) => setDeviceClass(v as DeviceClass | "all")}>
            <SelectTrigger aria-label="Filter by device type" className="md:w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(CLASS_LABEL) as DeviceClass[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CLASS_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tier} onValueChange={(v) => setTier(v as Criticality | "all")}>
            <SelectTrigger aria-label="Filter by criticality" className="md:w-36">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {(Object.keys(CRITICALITY_LABEL) as Criticality[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {CRITICALITY_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SectionCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Site</TableHead>
              <TableHead className="hidden sm:table-cell">Tier</TableHead>
              <TableHead className="hidden lg:table-cell">Link</TableHead>
              <TableHead className="hidden lg:table-cell">Firmware</TableHead>
              <TableHead className="text-right">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No devices match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((device) => (
                <TableRow
                  key={device.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${device.name}`}
                  className="cursor-pointer"
                  onClick={() => setSelected(device)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelected(device)
                    }
                  }}
                >
                  <TableCell>
                    <p className="font-mono text-sm text-foreground">{device.name}</p>
                    <p className="text-xs text-muted-foreground">{CLASS_LABEL[device.deviceClass]}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={device.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{device.site}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <TierBadge tier={device.criticality} />
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{LINK_LABEL[device.link]}</TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">{device.firmware ?? "Unknown"}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{formatTimeAgo(device.lastSeen)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {snapshot.devices.length} devices
      </p>

      <DeviceSheet device={selected} snapshot={snapshot} onClose={() => setSelected(null)} />
    </div>
  )
}
