import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CAPABILITY_GROUPS } from "@/lib/platform/content"

export function PlatformCapabilities() {
  return (
    <section aria-labelledby="capabilities-heading" className="container mx-auto max-w-6xl px-4 py-16">
      <div className="mb-12 max-w-2xl">
        <h2 id="capabilities-heading" className="text-balance text-3xl font-semibold tracking-tight">
          What you can do on the platform
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Every area below is a live part of the suite, not a mock-up. Each card also says what a developer can take
          from it.
        </p>
      </div>

      <div className="flex flex-col gap-14">
        {CAPABILITY_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xl font-semibold">{group.title}</h3>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">{group.blurb}</p>
            <ul
              className={`grid gap-4 sm:grid-cols-2 ${group.items.length % 3 === 0 ? "lg:grid-cols-3" : ""}`}
            >
              {group.items.map((item) => (
                <li key={item.name}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="size-5" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription className="leading-relaxed">{item.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="border-t pt-3 text-sm leading-relaxed">
                        <span className="font-medium">For developers: </span>
                        <span className="text-muted-foreground">{item.forDevelopers}</span>
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
