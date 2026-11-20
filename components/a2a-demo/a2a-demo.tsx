"use client"

import { useEffect, useRef, useState } from "react"
import { CircleCheck, CircleX, Handshake, Play, RotateCcw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { SCENARIOS, type DemoResult, type EngineId, type ScenarioId } from "@/lib/aethernet-demo/types"
import { ArchitectureDiagram } from "./architecture-diagram"
import { EngineSwitch } from "./engine-switch"
import { NextSteps } from "./next-steps"
import { QuasKvsDifference } from "./quas-kvs-difference"
import { StepCard } from "./step-card"
import { useDemoRun } from "./use-demo-run"

const SCENARIO_ORDER: ScenarioId[] = ["clean", "tamper", "rogue"]

function ResultBanner({ result }: { result: DemoResult }) {
  const settled = result.outcome === "settled"
  return (
    <Alert variant={settled ? "default" : "destructive"} className="border-l-4">
      {settled ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <CircleX className="h-4 w-4" aria-hidden="true" />}
      <AlertTitle>{settled ? "Settled" : "Blocked before any funds moved"}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{result.headline}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt>Run time</dt>
            <dd className="tabular-nums">{(result.totalMs / 1000).toFixed(1)} s</dd>
          </div>
          {result.blockedBy && (
            <div className="flex justify-between gap-3">
              <dt>Stopped by</dt>
              <dd className="text-right">{result.blockedBy}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt>Audit root</dt>
            <dd className="truncate font-mono" title={result.auditRoot}>
              {result.auditRoot.slice(0, 16)}…
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Platform ML-DSA attestation</dt>
            <dd>{result.attested ? "Signed" : "Not configured"}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt>A2A task</dt>
            <dd className="truncate text-right font-mono" title={result.a2aTaskId ?? result.a2aNote ?? ""}>
              {result.a2aTaskId ?? result.a2aNote ?? "Not recorded"}
            </dd>
          </div>
        </dl>
      </AlertDescription>
    </Alert>
  )
}

export function A2ADemo() {
  const { steps, result, status, error, run } = useDemoRun()
  const [scenario, setScenario] = useState<ScenarioId>("clean")
  const [engine, setEngine] = useState<EngineId>("standin")
  const running = status === "running"
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (running && steps.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [running, steps.length])

  return (
    <div className="min-h-screen flex-1 space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Handshake className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Live A2A settlement demo</h1>
            <p className="text-sm text-muted-foreground">
              Two AI agents negotiate a $2M parts order and settle it over post-quantum sealed messages
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit font-normal">
          Live models and post-quantum crypto · QUAS and KVS stand-ins
        </Badge>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <EngineSwitch engine={engine} onEngineChange={setEngine} disabled={running} />
          <div role="radiogroup" aria-label="Scenario" className="grid gap-3 md:grid-cols-3">
            {SCENARIO_ORDER.map((id) => {
              const selected = scenario === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={running}
                  onClick={() => setScenario(id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{SCENARIOS[id].label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{SCENARIOS[id].summary}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Meridian Aerospace buys 2,400 titanium actuator housings from Helix Precision with a $2,000,000 human-set ceiling.
            </p>
            <Button onClick={() => run(scenario, engine)} disabled={running} className="shrink-0">
              {running ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Agents working
                </>
              ) : status === "idle" ? (
                <>
                  <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                  Run the demo
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Run again
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>The demo stopped</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {steps.length > 0 && (
        <section aria-label="Live run" className="space-y-4">
          <ol className="space-y-3" aria-live="polite">
            {steps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </ol>
          {result && <ResultBanner result={result} />}
          <div ref={bottomRef} />
        </section>
      )}

      <ArchitectureDiagram steps={steps} running={running} />

      <QuasKvsDifference />

      <NextSteps />
    </div>
  )
}
