"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { LogIn, Menu, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function ConditionalSiteHeader() {
  const pathname = usePathname()

  if (pathname?.startsWith("/ai-suite") || pathname === "/login" || pathname === "/signup" || pathname === "/") {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
          <Image
            src="/logos/kronova-logo-header.svg"
            alt="Kronova"
            width={180}
            height={40}
            className="h-6 w-auto"
            priority
          />
        </Link>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-transparent border-primary/30 hover:border-primary/60 hover:bg-primary/10 hover:text-foreground",
            )}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90",
            )}
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[260px] glass-morphism border-l border-border/50">
            <div className="flex items-center gap-2 mb-5">
              <Image
                src="/logos/kronova-logo-icon.svg"
                alt="Kronova"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <div>
                <h3 className="text-xs font-bold text-foreground leading-tight">KRONOVA</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">INTELLIGENT SYSTEMS</p>
              </div>
            </div>
            <nav className="flex flex-col gap-2">
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-xl border border-primary/30 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                </span>
                Login
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                </span>
                Sign Up
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
