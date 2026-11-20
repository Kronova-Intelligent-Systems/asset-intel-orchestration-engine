#!/usr/bin/env node
/**
 * Kronova deployment runner (reference implementation).
 *
 * Runs on the customer's machine. It polls Kronova over outbound HTTPS only, so no
 * inbound firewall rules are needed, claims queued deployment jobs for its target and
 * reports the outcome.
 *
 * Kronova never tells this runner what to execute. For each model in a job it runs the
 * command YOU configure, with the model id passed as an argument (no shell is used):
 *
 *   KRONOVA_RUNNER_TOKEN   runner token from POST /api/v1/deployment/targets (required)
 *   KRONOVA_URL            base URL, e.g. https://app.kronova.io (required)
 *   KRONOVA_DEPLOY_COMMAND your deploy program, e.g. /opt/kronova/deploy-model.sh (required)
 *   KRONOVA_POLL_SECONDS   poll interval, default 30
 *   KRONOVA_DEPLOY_TIMEOUT_SECONDS  per-model timeout, default 1800
 *
 * The command is called as: <command> <model_id> <security_profile>
 * Exit code 0 means the model is deployed. Anything else fails the job.
 * Run with --once to poll a single time (useful for cron or tests).
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

const token = process.env.KRONOVA_RUNNER_TOKEN
const baseUrl = (process.env.KRONOVA_URL || "").replace(/\/+$/, "")
const command = process.env.KRONOVA_DEPLOY_COMMAND
const pollMs = Math.max(5, Number(process.env.KRONOVA_POLL_SECONDS) || 30) * 1000
const timeoutMs = Math.max(10, Number(process.env.KRONOVA_DEPLOY_TIMEOUT_SECONDS) || 1800) * 1000
const once = process.argv.includes("--once")
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

if (!token || !baseUrl || !command) {
  console.error("KRONOVA_RUNNER_TOKEN, KRONOVA_URL and KRONOVA_DEPLOY_COMMAND are required")
  process.exit(1)
}

async function api(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${json.error ?? ""}`.trim())
  return json.data
}

async function execute(job) {
  await api(`/api/v1/deployment/runner/jobs/${job.id}`, { status: "running" })
  const deployed = []
  for (const model of job.model_ids) {
    if (!MODEL_ID.test(model) || model.includes("..")) {
      return { status: "failed", error: `Rejected unsafe model id`, result: { deployed } }
    }
    try {
      const { stdout } = await run(command, [model, job.security_profile], { timeout: timeoutMs, maxBuffer: 1024 * 1024 })
      deployed.push({ model, ok: true, output: stdout.slice(-500) })
    } catch (error) {
      return {
        status: "failed",
        error: `Deploying ${model} failed: ${String(error.message).slice(0, 500)}`,
        result: { deployed, failed_model: model },
      }
    }
  }
  return { status: "succeeded", result: { deployed } }
}

async function tick() {
  const { job } = await api("/api/v1/deployment/runner/poll", {
    runner_version: "1.0.0",
    capabilities: { platform: process.platform, node: process.version },
  })
  if (!job) return false
  console.log(`claimed job ${job.id} (${job.model_ids.join(", ")})`)
  const outcome = await execute(job)
  await api(`/api/v1/deployment/runner/jobs/${job.id}`, outcome)
  console.log(`job ${job.id} ${outcome.status}`)
  return true
}

async function main() {
  do {
    try {
      // Drain the queue before sleeping.
      while (await tick()) if (once) break
    } catch (error) {
      console.error(String(error.message ?? error))
    }
    if (once) return
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  } while (true)
}

main()
