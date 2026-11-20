// Count-only probe of what the public anon key can reach. Never reads row values.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/security-check-anon.mjs
// Exits 1 if anon can see any row of a protected object or any sensitive profile column.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(2)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" }

async function probe(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers })
  const range = res.headers.get("content-range") || ""
  const count = Number(range.split("/")[1])
  return { status: res.status, count: Number.isFinite(count) ? count : null }
}

const sensitiveProfileColumns = ["stripe_customer_id", "waddress", "email", "username", "role", "id"]
const protectedObjects = [
  "profiles", "api_keys", "api_routes", "messages", "reusable_packages", "inqueries",
  "asset_analytics", "asset_intelligence_learning_stats", "embedding_job_stats",
  "iot_sensor_analytics", "latest_asset_sensor_readings", "package_shipment_details",
  "package_utilization", "packaging_order_analytics", "shipping_analytics",
  "unified_workflows", "user_oauth_clients", "assets", "a2a_tasks",
  "a2a_push_notification_configs", "deployment_targets", "data_stores",
]

const failures = []

for (const column of sensitiveProfileColumns) {
  const { status, count } = await probe(`profiles?select=${column}&limit=0`)
  const blocked = status >= 400 || count === 0
  console.log(`${blocked ? "ok  " : "FAIL"} anon profiles.${column} -> ${status} rows=${count}`)
  if (!blocked) failures.push(`profiles.${column}`)
}

for (const name of protectedObjects) {
  const { status, count } = await probe(`${name}?select=*&limit=0`)
  const blocked = status >= 400 || count === 0
  console.log(`${blocked ? "ok  " : "FAIL"} anon ${name} -> ${status} rows=${count}`)
  if (!blocked) failures.push(name)
}

const view = await probe("public_profile_cards?select=stripe_customer_id&limit=0")
console.log(`${view.status === 400 ? "ok  " : "FAIL"} public_profile_cards.stripe_customer_id -> ${view.status}`)
if (view.status !== 400) failures.push("public_profile_cards exposes stripe_customer_id")

if (failures.length) {
  console.error(`\n${failures.length} exposure(s): ${failures.join(", ")}`)
  process.exit(1)
}
console.log("\nNo anon exposure detected.")
