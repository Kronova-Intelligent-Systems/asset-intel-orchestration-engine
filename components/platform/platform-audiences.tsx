import { Check } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AUDIENCES } from "@/lib/platform/content"

export function PlatformAudiences() {
  return (
    <section aria-labelledby="audiences-heading" className="border-y bg-muted/30">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <h2 id="audiences-heading" className="text-balance text-3xl font-semibold tracking-tight">
          How it helps
        </h2>
        <p className="mb-8 mt-3 text-pretty leading-relaxed text-muted-foreground">
          The platform is free because its job is to show what a well-structured agent system looks like. Pick the
          description closest to you.
        </p>

        <Tabs defaultValue={AUDIENCES[0].id}>
          <TabsList className="h-auto flex-wrap justify-start">
            {AUDIENCES.map((audience) => (
              <TabsTrigger key={audience.id} value={audience.id}>
                {audience.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {AUDIENCES.map((audience) => (
            <TabsContent key={audience.id} value={audience.id} className="mt-6">
              <h3 className="text-xl font-semibold">{audience.headline}</h3>
              <ul className="mt-5 flex flex-col gap-3">
                {audience.points.map((point) => (
                  <li key={point} className="flex gap-3 leading-relaxed">
                    <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
