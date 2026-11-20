export const CRON_JOB_NAME = "kronova-model-ops"
export const CRON_SCHEDULE = "0 6 * * *"
export const CRON_SCHEDULE_PATTERN = /^[\d*/,-]+( [\d*/,-]+){4}$/
const VAULT_SECRET_NAME = "kronova_cron_secret"
const SECRET_PATTERN = /^[A-Za-z0-9._~+/=-]{16,200}$/
const SITE_PATTERN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i

export interface CronPrerequisites {
  ok: boolean
  reason?: string
  siteUrl?: string
}

export function cronPrerequisites(): CronPrerequisites {
  if (!process.env.SUPABASE_MANAGEMENT_API_TOKEN) return { ok: false, reason: "SUPABASE_MANAGEMENT_API_TOKEN is not set" }
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, reason: "CRON_SECRET is not set" }
  if (!SECRET_PATTERN.test(secret)) return { ok: false, reason: "CRON_SECRET must be 16-200 URL-safe characters" }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")
  if (!SITE_PATTERN.test(siteUrl)) return { ok: false, reason: "NEXT_PUBLIC_SITE_URL must be an https origin" }
  return { ok: true, siteUrl }
}

export function buildCommand(siteUrl: string): string {
  return (
    `select net.http_get(url := '${siteUrl}/api/cron/model-ops', ` +
    `headers := jsonb_build_object('Authorization', 'Bearer ' || ` +
    `(select decrypted_secret from vault.decrypted_secrets where name = '${VAULT_SECRET_NAME}' limit 1)), ` +
    `timeout_milliseconds := 120000);`
  )
}

async function runSql(query: string, scrub?: string): Promise<Array<Record<string, unknown>>> {
  const token = process.env.SUPABASE_MANAGEMENT_API_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!token || !url) throw new Error("Supabase management access is not configured")
  const ref = new URL(url).hostname.split(".")[0]
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  if (!response.ok) {
    const safe = scrub ? text.split(scrub).join("[redacted]") : text
    throw new Error(`Management API ${response.status}: ${safe.slice(0, 300)}`)
  }
  return JSON.parse(text) as Array<Record<string, unknown>>
}

export interface CronJobInfo {
  schedule: string
  command: string
  active: boolean
}

export async function getCronJob(name: string): Promise<CronJobInfo | null> {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Invalid job name")
  const rows = await runSql(`select schedule, command, active from cron.job where jobname = '${name}' limit 1`)
  const row = rows[0]
  return row ? { schedule: String(row.schedule), command: String(row.command), active: Boolean(row.active) } : null
}

/** Creates or updates only the model-ops job. The command is rebuilt here, never taken from a plan. */
export async function ensureCronJob(schedule: string): Promise<string> {
  const pre = cronPrerequisites()
  if (!pre.ok || !pre.siteUrl) throw new Error(pre.reason ?? "Cron prerequisites are not met")
  if (!CRON_SCHEDULE_PATTERN.test(schedule)) throw new Error("Invalid cron schedule")
  const secret = process.env.CRON_SECRET!

  const existing = await runSql(`select id from vault.secrets where name = '${VAULT_SECRET_NAME}' limit 1`)
  if (existing[0]?.id) {
    await runSql(`select vault.update_secret('${String(existing[0].id)}'::uuid, $kv$${secret}$kv$)`, secret)
  } else {
    await runSql(
      `select vault.create_secret($kv$${secret}$kv$, '${VAULT_SECRET_NAME}', 'Bearer secret pg_cron uses to call the model-ops route')`,
      secret,
    )
  }
  const result = await runSql(
    `select cron.schedule('${CRON_JOB_NAME}', '${schedule}', $kv$${buildCommand(pre.siteUrl)}$kv$) as jobid`,
  )
  return `pg_cron job ${CRON_JOB_NAME} (id ${String(result[0]?.jobid)}) set to "${schedule}"`
}
