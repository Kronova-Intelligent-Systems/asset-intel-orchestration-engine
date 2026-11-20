import { createClient } from "@supabase/supabase-js"

// Untyped on purpose: model_ops_runs is not in the generated database types.
export function opsDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase URL or service role key is not set")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Model ops changes the shared catalog, so access is an explicit allowlist, not a scope. */
export function isModelOpsAdmin(userId: string): boolean {
  const allowed = (process.env.MODEL_OPS_ADMIN_USER_IDS ?? process.env.SEED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  return allowed.includes(userId)
}
