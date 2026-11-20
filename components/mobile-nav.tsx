"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface MobileNavProps {
  items?: {
    title: string
    href: string
    description?: string
  }[]
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  const handleLinkClick = (href: string) => {
    console.log("[v0] Mobile nav link clicked:", href)
    setOpen(false)

    setTimeout(() => {
      window.location.href = href
    }, 100)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="md:hidden
          mr-0
           px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <Menu className="h-6 w-6 fill-current" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xs bg-black/95 border-green-500/30 text-white">
        <nav className="flex flex-col mt-6 divide-y divide-white/10">
          {items?.map((item) => (
            <button
              key={item.href}
              onClick={() => handleLinkClick(item.href)}
              className={cn(
                "flex min-h-11 items-center py-2.5 text-sm font-medium leading-tight transition-colors text-left hover:text-green-400",
                pathname === item.href ? "text-green-400" : "text-gray-200",
              )}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
