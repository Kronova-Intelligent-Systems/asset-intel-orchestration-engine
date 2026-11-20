import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PILOT } from "@/lib/pilot/config"
import { PATHWAY } from "@/lib/platform/content"

export function PlatformPathway() {
  return (
    <section aria-labelledby="pathway-heading" className="container mx-auto max-w-5xl px-4 py-16">
      <div className="mb-10 max-w-2xl">
        <h2 id="pathway-heading" className="text-balance text-3xl font-semibold tracking-tight">
          From open stand-ins to attested hardware
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          The suite is built to be outgrown on purpose. It shows the pattern with open components, then makes clear
          where an institution needs a stronger trust layer.
        </p>
      </div>

      <ol className="grid gap-4 md:grid-cols-2">
        {PATHWAY.map((item) => (
          <li key={item.step} className="flex gap-4 rounded-xl border bg-card p-5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {item.step}
            </span>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-4 rounded-xl border bg-muted/40 p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h3 className="text-lg font-semibold">{PILOT.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A {PILOT.durationDays}-day evaluation of AetherNet QUAS and KVS with waived licensing fees in the sandbox,
            self-serve credentials and bi-weekly architecture syncs. One institutional slot is available per design
            partner.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <a href={PILOT.url} target="_blank" rel="noopener noreferrer">
            Review the pilot
            <ArrowUpRight className="size-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
      </div>
    </section>
  )
}

export function PlatformClosingCta() {
  return (
    <section className="border-t bg-muted/30">
      <div className="container mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight">Start with the free suite</h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Create an account, run the settlement demo, and decide for yourself where the open stack ends.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Create a free account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
