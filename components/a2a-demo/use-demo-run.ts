"use client"

import { useCallback, useRef, useState } from "react"
import type { DemoEvent, DemoResult, DemoStep, EngineId, ScenarioId } from "@/lib/aethernet-demo/types"

export type RunStatus = "idle" | "running" | "done" | "error"

export function useDemoRun() {
  const [steps, setSteps] = useState<DemoStep[]>([])
  const [result, setResult] = useState<DemoResult | null>(null)
  const [status, setStatus] = useState<RunStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const run = useCallback(async (scenario: ScenarioId, engine: EngineId = "standin") => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setSteps([])
    setResult(null)
    setError(null)
    setStatus("running")

    const handle = (event: DemoEvent) => {
      if (event.type === "step") setSteps((current) => [...current, event.step])
      else if (event.type === "done") {
        setResult(event.result)
        setStatus("done")
      } else {
        setError(event.message)
        setStatus("error")
      }
    }

    try {
      const response = await fetch("/api/v1/aethernet-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, engine }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.error === "string" ? body.error : "The demo could not start.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const line = frame.split("\n").find((part) => part.startsWith("data: "))
          if (line) handle(JSON.parse(line.slice(6)) as DemoEvent)
        }
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(caught instanceof Error ? caught.message : "The demo could not start.")
      setStatus("error")
    }
  }, [])

  return { steps, result, status, error, run }
}
