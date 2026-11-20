"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"

export function Footer() {
  const { resolvedTheme } = useTheme()

  const logoSrc = resolvedTheme === "dark" ? "/logos/kronova-logo-footer-dark.svg" : "/logos/kronova-logo-footer.svg"

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image src={logoSrc || "/placeholder.svg"} alt="Kronova" width={200} height={56} className="h-12 w-auto" />
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </Link>
            <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Support & Kairo
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kronova. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
