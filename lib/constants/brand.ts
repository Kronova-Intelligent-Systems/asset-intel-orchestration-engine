/**
 * Kronova Platform Brand Constants
 * Centralized brand configuration for consistent naming across the platform
 *
 * @version 2.0.0
 */

export const BRAND = {
  // Current branding
  name: "Kronova",
  tagline: "Transforming Data Into Actionable Insight",
  description: "Enterprise AI-Powered Asset Intelligence Platform",
  
  // Legacy branding (for backward compatibility)
  formerName: "Resend-It",
  
  // URLs and domains
  website: process.env.NEXT_PUBLIC_SITE_URL || "https://kronova.io",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.kronova.io",
  
  // Social and support
  support: {
    email: "support@kronova.io",
    docs: "https://docs.kronova.io",
    github: "https://github.com/kronova-intelligent-systems",
  },
  
  // Company information
  company: {
    legalName: "Kronova Inc.",
    formerLegalName: "Resend-It Inc.",
    copyright: `© ${new Date().getFullYear()} Kronova Inc. All rights reserved.`,
  },
  
  // Product names
  products: {
    platform: "Kronova Platform",
    sdk: "Kronova SDK",
    api: "Kronova API",
    oauthAgent: "Kronova OAuth Agent",
    aiTools: "Kronova AI Tools",
    aetherNet: "AetherNet by Kronova",
  },
  
  // Feature names
  features: {
    assetIntelligence: "Asset Intelligence",
    tokenization: "Asset Tokenization",
    aiAgents: "AI Agents",
    workflows: "Workflow Automation",
    marketplace: "Agent Marketplace",
    learningLayer: "Learning Layer",
  },
} as const

export const META = {
  defaultTitle: "Kronova - Enterprise AI Asset Intelligence",
  titleTemplate: "%s | Kronova",
  description: "Transform your asset management with AI-powered intelligence, blockchain tokenization, and autonomous agents.",
  keywords: [
    "AI asset intelligence",
    "asset tokenization",
    "blockchain",
    "Sui Move",
    "enterprise AI",
    "workflow automation",
    "predictive maintenance",
    "asset tracking",
    "OAuth 2.1",
    "multi-modal AI",
  ],
  
  // Open Graph / Social Media
  og: {
    type: "website",
    siteName: BRAND.name,
    locale: "en_US",
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    site: "@kronova_ai",
    creator: "@kronova_ai",
  },
} as const

export const VERSIONS = {
  platform: "2.0.0",
  sdk: "2.0.0",
  api: "v2.0.0",
  rebrandDate: "2026-01-21",
} as const

/**
 * Helper function to get display name with legacy fallback
 */
export function getBrandName(context?: "current" | "legacy" | "with-legacy"): string {
  switch (context) {
    case "legacy":
      return BRAND.formerName
    case "with-legacy":
      return `${BRAND.name} (Formerly ${BRAND.formerName})`
    case "current":
    default:
      return BRAND.name
  }
}

/**
 * Helper function to get product name
 */
export function getProductName(product: keyof typeof BRAND.products): string {
  return BRAND.products[product]
}

/**
 * Helper to check if running in legacy mode (for gradual migration)
 */
export function isLegacyMode(): boolean {
  // Could be controlled by environment variable if needed
  return process.env.NEXT_PUBLIC_LEGACY_MODE === "true"
}
