import { readFile } from "node:fs/promises"
import path from "node:path"
import { parse } from "yaml"

// Rendered once at build time from the same file that is committed to the repo,
// so the downloadable spec can never drift from api-specifications.yaml.
export const dynamic = "force-static"

export async function GET() {
  const source = await readFile(path.join(process.cwd(), "api-specifications.yaml"), "utf8")

  return Response.json(parse(source), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
