export const WEBHOOK_EVENTS = [
  { value: "agent.execution.completed", label: "Agent Execution Completed" },
  { value: "agent.execution.failed", label: "Agent Execution Failed" },
  { value: "workflow.execution.completed", label: "Workflow Execution Completed" },
  { value: "workflow.execution.failed", label: "Workflow Execution Failed" },
  { value: "asset.created", label: "Asset Created" },
  { value: "asset.updated", label: "Asset Updated" },
] as const

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number]["value"]

export const WEBHOOK_EVENT_NAMES: readonly string[] = WEBHOOK_EVENTS.map((event) => event.value)
