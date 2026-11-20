import { HeaderContent } from "@/components/header-content"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function SiteHeader() {
  let user = null

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.log("[v0] SiteHeader: Auth error (user will be null):", error.message)
    } else {
      user = authUser
      console.log("[v0] SiteHeader: User fetched:", user ? "authenticated" : "not authenticated")
    }
  } catch (error) {
    console.error("[v0] SiteHeader: Failed to create Supabase client:", error)
  }

  const mainNavItems = [
    { title: "About", href: "/about" },
    
  ]

  const authNavItems = user
    ? [
        { title: "AI Suite", href: "/ai-suite" },
        //{ title: "Integrations", href: "/ai-suite/integrations" },
        //{ title: "Subscription", href: "/ai-suite/billing" },
        //{ title: "Demo", href: "/demo" },
        //{ title: "CRM", href: "/admin/crm" },
      ]
    : [
        { title: "Login", href: "/login" },
        { title: "Sign Up", href: "/signup" },
      ]

  const allNavItems = [...mainNavItems, ...authNavItems]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <HeaderContent user={user} mainNavItems={mainNavItems} authNavItems={authNavItems} allNavItems={allNavItems} />
    </header>
  )
}
