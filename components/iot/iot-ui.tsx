import { FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CheckState } from "@/lib/iot/metrics"
import {
  CRITICALITY_DESCRIPTION,
  CRITICALITY_LABEL,
  STATUS_LABEL,
  type AlertSeverity,
  type Criticality,
  type DeviceStatus,
  type SampleReason,
  type SettlementStatus,
} from "@/lib/iot/types"

export const STATUS_DOT: Record<DeviceStatus, string> = {
  online: "bg-emerald-500",
  alert: "bg-amber-500",
  maintenance: "bg-sky-500",
  offline: "bg-red-500",
  inactive: "bg-muted-foreground/50",
}

const STATUS_TEXT: Record<DeviceStatus, string> = {
  online: "text-emerald-600 dark:text-emerald-400",
  alert: "text-amber-600 dark:text-amber-400",
  maintenance: "text-sky-600 dark:text-sky-400",
  offline: "text-red-600 dark:text-red-400",
  inactive: "text-muted-foreground",
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STATUS_TEXT[status])}>
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge variant="outline" className={cn("capitalize", SEVERITY_STYLE[severity])}>
      {severity}
    </Badge>
  )
}

export function TierBadge({ tier, withDescription = false }: { tier: Criticality; withDescription?: boolean }) {
  return (
    <Badge variant="outline" className={cn("font-normal", tier === "tier0" && "border-primary/50 text-primary")}>
      {CRITICALITY_LABEL[tier]}
      {withDescription && <span className="ml-1 text-muted-foreground">{CRITICALITY_DESCRIPTION[tier]}</span>}
    </Badge>
  )
}

const CHECK_STYLE: Record<CheckState, { label: string; className: string }> = {
  pass: { label: "Healthy", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  warn: { label: "Review", className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  fail: { label: "Action needed", className: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
  unknown: { label: "No data", className: "text-muted-foreground" },
}

export function CheckBadge({ state }: { state: CheckState }) {
  const style = CHECK_STYLE[state]
  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  )
}

const SETTLEMENT_STYLE: Record<SettlementStatus, { label: string; className: string }> = {
  finalized: { label: "Finalised", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  queued: { label: "Queued for uplink", className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  signed: { label: "Signed", className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  rejected: { label: "Rejected", className: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
}

export function SettlementBadge({ status }: { status: SettlementStatus }) {
  const style = SETTLEMENT_STYLE[status]
  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  )
}

export function SampleDataNotice({ reason, subject = "devices" }: { reason: SampleReason | null; subject?: string }) {
  const detail =
    reason === "unavailable"
      ? `Live ${subject} could not be loaded, so illustrative sample data is shown.`
      : reason === "empty"
        ? `No ${subject} are registered to your account yet. Illustrative sample data is shown until they are.`
        : `Illustrative sample data. Live ${subject} will replace it once connected.`

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Sample data. </span>
        {detail}
      </p>
    </div>
  )
}

export function SectionCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card text-card-foreground", className)}>{children}</div>
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
