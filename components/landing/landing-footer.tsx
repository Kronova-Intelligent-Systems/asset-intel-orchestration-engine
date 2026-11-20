"use client"

import Link from "next/link"
import Image from "next/image"
import { Github, Linkedin, Twitter } from "lucide-react"
import { useTheme } from "next-themes"

export function LandingFooter() {
  const currentYear = new Date().getFullYear()
  const { resolvedTheme } = useTheme()

  const logoSrc = resolvedTheme === "dark" ? "/logos/kronova-logo-footer-dark.svg" : "/logos/kronova-logo-footer.svg"

  const socialLinks = [
    { name: "GitHub", href: "#", icon: <Github className="h-5 w-5" /> },
    { name: "Twitter", href: "#", icon: <Twitter className="h-5 w-5" /> },
    { name: "LinkedIn", href: "#", icon: <Linkedin className="h-5 w-5" /> },
  ]
  const footerNavs = [
    {
      label: "Product",
      items: [
        { href: "#features", name: "Features" },
        { href: "#solutions", name: "Solutions" },
        { href: "/pricing", name: "Pricing" },
        { href: "/demo", name: "Request Demo" },
      ],
    },
    {
      label: "Company",
      items: [
        { href: "/about", name: "About Us" },
        { href: "/blog", name: "Blog" },
        { href: "/careers", name: "Careers" },
        { href: "/contact", name: "Contact Us" },
      ],
    },
    {
      label: "Resources",
      items: [
        { href: "/docs", name: "Documentation & SDK" },
        { href: "/support", name: "Support & Kairo" },
        { href: "/sustainability", name: "Sustainability" },
      ],
    },
    {
      label: "Legal",
      items: [
        { href: "/terms", name: "Terms of Service" },
        { href: "/privacy", name: "Privacy Policy" },
        { href: "/cookies", name: "Cookie Policy" },
      ],
    },
  ]

  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Image
                src={logoSrc || "/placeholder.svg"}
                alt="Kronova"
                width={200}
                height={56}
                className="h-14 w-auto"
              />
            </Link>
            <p className="text-muted-foreground max-w-sm">
              AI-Powered Business Transformation for the Future of Enterprise.
            </p>
            <div className="flex space-x-3 mt-6">
              {socialLinks.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label={item.name}
                >
                  {item.icon}
                </Link>
              ))}
            </div>
          </div>
          {footerNavs.map((nav) => (
            <div key={nav.label}>
              <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">{nav.label}</h3>
              <ul className="mt-4 space-y-3">
                {nav.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Kronova Technologies Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
