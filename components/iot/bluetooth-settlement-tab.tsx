"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Bluetooth, DatabaseZap, FileSignature, Network, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useProximitySettlements } from "@/lib/hooks/use-iot-command"
import { computeSettlementSummary, formatTimeAgo } from "@/lib/iot/metrics"
import { SampleDataNotice, SectionCard, SectionHeader, SettlementBadge } from "./iot-ui"

const STEPS = [
  {
    icon: Bluetooth,
    title: "Proximity handshake",
    body: "Two devices discover each other over Bluetooth LE and agree the terms in range.",
  },
  {
    icon: FileSignature,
    title: "Signed intent",
    body: "Each side signs the settlement intent with a post-quantum signature.",
  },
  {
    icon: DatabaseZap,
    title: "Held in KVS",
    body: "The signed intent is stored in KVS, so it survives without an uplink.",
  },
  {
    icon: Network,
    title: "Finalised by QUAS",
    body: "When connectivity returns, QUAS verifies both signatures and settles.",
  },
  {
    icon: ReceiptText,
    title: "Receipt",
    body: "A receipt is written back to KVS as the audit record for both parties.",
  },
]

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "No data"
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <SectionCard className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </SectionCard>
  )
}

export function BluetoothSettlementTab() {
  const { data, isLoading } = useProximitySettlements()
  const settlements = data?.settlements
  const summary = useMemo(() => computeSettlementSummary(settlements ?? []), [settlements])

  return (
    <div className="space-y-6">
      <SampleDataNotice reason={null} subject="settlement activity" />

      <SectionCard>
        <SectionHeader
          title="Bluetooth proximity settlement"
          description="Reference flow for settling between devices that are near each other, with or without a network connection"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ai-suite/aethernet">
                AetherNet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recent settlements" value={String(summary.total)} hint="Sample window" />
        <Stat label="Median time to finalise" value={formatDuration(summary.medianFinalizeSeconds)} hint="Signed to finalised" />
        <Stat
          label="Awaiting uplink"
          value={String(summary.queued + summary.signed)}
          hint={`${summary.offlineOriginated} originated offline`}
        />
        <Stat label="Rejected" value={String(summary.rejected)} hint="Failed verification or range" />
      </div>

      <SectionCard className="overflow-hidden">
        <SectionHeader title="Settlement ledger" description="Most recent first" />
        {isLoading || !settlements ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Path</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right md:table-cell">Signed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-mono text-xs text-foreground">{s.initiator}</p>
                    <p className="font-mono text-xs text-muted-foreground">to {s.counterparty}</p>
                  </TableCell>
                  <TableCell>
                    <SettlementBadge status={s.status} />
                    {s.rejectionReason && <p className="mt-1 text-xs text-muted-foreground">{s.rejectionReason}</p>}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {s.offline ? "Offline, then uplink" : "Online"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{s.amount.toFixed(2)}</TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground md:table-cell">
                    {formatTimeAgo(s.signedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
