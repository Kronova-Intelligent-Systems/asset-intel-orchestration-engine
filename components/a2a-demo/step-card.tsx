"use client"

import { motion } from "framer-motion"
import { Bot, Check, CircleSlash, Cpu, Database, Globe, Landmark, Radio, ShieldCheck, X } from "lucide-react"
import type { ComponentType } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ActorId, DemoStep, Provenance, Tier } from "@/lib/aethernet-demo/types"

const ACTOR: Record<ActorId, { label: string; icon: ComponentType<{ className?: string }> }> = {
  buyer: { label: "Meridian buyer agent", icon: Bot },
  supplier: { label: "Helix supplier agent", icon: Bot },
  gateway: { label: "Blind edge gateway (stand-in)", icon: Globe },
  kvs: { label: "Counterparty memory (KVS stand-in)", icon: Database },
  quas: { label: "Mandate policy engine (QUAS stand-in)", icon: ShieldCheck },
  iot: { label: "Cargo sensor", icon: Radio },
  canton: { label: "Canton ledger", icon: Landmark },
  platform: { label: "Kronova platform", icon: Cpu },
}

const ENCLAVE_ACTOR: Partial<Record<ActorId, string>> = {
  kvs: "AetherNet KVS (attested enclave)",
  quas: "AetherNet QUAS (attested enclave)",
}

const PROVENANCE: Record<Provenance, { label: string; className: string }> = {
  live: { label: "Live", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  standin: { label: "Stand-in", className: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  simulated: { label: "Simulated", className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  aethernet: { label: "AetherNet enclave", className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
}

const TIER_RAIL: Record<Tier, string> = {
  1: "bg-cyan-500",
  2: "bg-slate-400",
  3: "bg-violet-500",
  4: "bg-emerald-500",
}

export function StepCard({ step }: { step: DemoStep }) {
  const actor = ACTOR[step.actor]
  const ActorIcon = actor.icon
  const rejected = step.status === "rejected"
  const provenance = PROVENANCE[step.provenance]
  const actorLabel = step.provenance === "aethernet" && step.actor in ENCLAVE_ACTOR ? ENCLAVE_ACTOR[step.actor] : actor.label

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative flex gap-3 overflow-hidden rounded-lg border bg-card p-4 pl-5",
        rejected ? "border-destructive/60" : "border-border",
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1", rejected ? "bg-destructive" : TIER_RAIL[step.tier])}
        aria-hidden="true"
      />
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          rejected ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
        )}
      >
        {rejected ? <CircleSlash className="h-4 w-4" aria-hidden="true" /> : <ActorIcon className="h-4 w-4" aria-hidden="true" />}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-muted-foreground">
              {step.seq}. {actorLabel} · Tier {step.tier}
            </span>
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[11px] font-medium", provenance.className)}>
              {provenance.label}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">{step.durationMs} ms</span>
          </div>
          <h3 className={cn("text-sm font-semibold leading-snug text-foreground", rejected && "text-destructive")}>
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
        </div>

        {step.message && (
          <figure className="rounded-md border border-border bg-muted/40 p-3">
            <figcaption className="mb-1 text-xs text-muted-foreground">
              {ACTOR[step.message.from].label} to {ACTOR[step.message.to].label}
              {step.message.model && (
                <span>
                  {" "}
                  · <span className="font-mono">{step.message.model}</span>
                  {step.message.fallback && " (scripted fallback)"}
                </span>
              )}
            </figcaption>
            <blockquote className="text-sm leading-relaxed text-foreground">{step.message.text}</blockquote>
          </figure>
        )}

        {step.facts && step.facts.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {step.facts.map((fact) => (
              <div key={fact.label} className="flex min-w-0 flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <dt className="shrink-0 text-muted-foreground">{fact.label}</dt>
                <dd className={cn("min-w-0 break-words text-foreground sm:truncate sm:text-right", fact.mono && "font-mono break-all")} title={fact.value}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {step.checks && step.checks.length > 0 && (
          <ul className="space-y-1.5">
            {step.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2 text-xs">
                {check.pass ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Passed" />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Failed" />
                )}
                <span className="min-w-0">
                  <span className={cn("font-medium", check.pass ? "text-foreground" : "text-destructive")}>{check.label}</span>
                  <span className="text-muted-foreground"> · {check.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.li>
  )
}
