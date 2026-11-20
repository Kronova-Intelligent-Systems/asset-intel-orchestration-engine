import Link from "next/link"
import { ArrowRight, Gift } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function PlatformHero() {
  return (
    <section className="border-b bg-muted/30">
      <div className="container mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center md:py-24">
        <Badge variant="secondary" className="gap-1.5">
          <Gift className="size-3.5" aria-hidden="true" />
          Free to use
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          A free reference platform for building and governing AI agents
        </h1>
        <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          The AI Business Suite is a working system you can use today and learn from. Run agents and workflows, search
          your own data, connect real assets and watch two agents settle a deal. Use it as it is, or follow its
          structure when you build your own.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">
              Create a free account
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login?redirect=/ai-suite/a2a-demo">Open the live settlement demo</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign up with email, GitHub or Google. No payment details are needed.
        </p>
      </div>
    </section>
  )
}
