"use client"

import { ArrowUpRight, CircleCheck, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PILOT, PILOT_COPY } from "@/lib/pilot/config"

interface PilotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PilotDialog({ open, onOpenChange }: PilotDialogProps) {
  const contactHref = PILOT.contactEmail
    ? `mailto:${PILOT.contactEmail}?subject=${encodeURIComponent("Enterprise Design Partner Pilot sync")}`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="text-balance text-xl">{PILOT_COPY.dialogTitle}</DialogTitle>
          <DialogDescription className="text-pretty leading-relaxed">{PILOT_COPY.dialogDescription}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="pilot-terms" className="space-y-3">
          <h3 id="pilot-terms" className="text-sm font-semibold text-foreground">
            What a design partner receives
          </h3>
          <dl className="divide-y rounded-lg border">
            {PILOT.terms.map((term) => (
              <div key={term.label} className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="text-muted-foreground">{term.label}</dt>
                <dd className="text-foreground">{term.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="pilot-fit" className="space-y-3">
          <h3 id="pilot-fit" className="text-sm font-semibold text-foreground">
            Who the pilot suits
          </h3>
          <ul className="space-y-2">
            {PILOT.fit.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:space-x-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {PILOT_COPY.secondaryCta}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {contactHref && (
              <Button asChild variant="outline">
                <a href={contactHref}>
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Email the team
                </a>
              </Button>
            )}
            <Button asChild>
              <a href={PILOT.url} target="_blank" rel="noopener noreferrer">
                {PILOT_COPY.primaryCta}
                <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
