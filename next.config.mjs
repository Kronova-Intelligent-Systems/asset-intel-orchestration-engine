import { createRequire } from "module"
const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 defaults to Turbopack and warns if a `webpack()` config (below)
  // is present without an explicit `turbopack` key, since that combination
  // usually means the config needs migrating. We don't need any Turbopack-
  // specific options - transpilePackages below already covers the packages
  // that previously needed the webpack resolve.alias/loader treatment - so
  // an empty object just acknowledges Turbopack is in use and silences the
  // warning.
  turbopack: {},
  reactStrictMode: true,
  experimental: {
    // Server Actions (e.g. sendSupportMessage) validate the request's Origin
    // header against this allowlist. Preview *.vercel.app URLs pass this check
    // automatically, but the production custom domain must be listed explicitly
    // or every Server Action call is silently rejected client-side.
    serverActions: {
      allowedOrigins: ["app.kronova.io", "kronova.io", "*.kronova.io"],
    },
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Allow microphone access on all pages (required for voice NLP)
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(), geolocation=()",
          },
          // Legacy Feature-Policy for older Android/Samsung Browser compatibility
          {
            key: "Feature-Policy",
            value: "microphone 'self'",
          },
          // X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, and
          // Referrer-Policy are already set on every request by proxy.ts's
          // addSecurityHeaders() - set them in exactly one place to avoid
          // conflicting values, so only headers proxy.ts doesn't own live here.
          // Force HTTPS for two years, including on first visit via preload.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Allow blob: URIs for MediaRecorder audio chunks and data: for inline assets
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              // blob: required for MediaRecorder .ondataavailable chunks
              "media-src 'self' blob: https:",
              "connect-src 'self' https: wss:",
              "font-src 'self' https: data:",
              "frame-src 'self' https:",
              "worker-src 'self' blob:",
              // Disallow legacy plugin content entirely (Flash/Java/etc.).
              "object-src 'none'",
              // Block <base href> injection from redirecting relative URLs.
              "base-uri 'self'",
              // Only this origin's own routes can be a form submission target.
              "form-action 'self'",
              // Modern replacement for X-Frame-Options, which proxy.ts already
              // sets to DENY on every response - 'none' matches that policy
              // and takes precedence over it in browsers that support CSP.
              "frame-ancestors 'none'",
              // Auto-upgrade any accidental http:// subresource reference to https.
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
  // @scure/base ships both index.ts and index.js with no "exports" map to
  // disambiguate them, so Turbopack's resolver picks the untranspiled .ts
  // source and throws "Unknown module type" (no loader registered for a
  // bare node_modules .ts file). transpilePackages forces it through the
  // same compiler pipeline as our own source, resolving the ambiguity.
  transpilePackages: ["@mysten/dapp-kit", "@mysten/sui", "@mysten/bcs", "@scure/base"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack(config) {
    // Pin all @mysten/bcs imports to the single root v2 copy so that nested
    // legacy copies (wallet-kit-core → sui.js → bcs@0.9/1.x) are never bundled.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@mysten/bcs": require.resolve("@mysten/bcs"),
    }

    // Apply the module-resolver loader to every @mysten package so that
    // legacy @mysten/sui.js imports, deprecated class names, and old function
    // names (fromB64 → fromBase64, SuiClient → SuiJsonRpcClient, etc.) are
    // rewritten at bundle time regardless of where they originate.
    config.module.rules.push({
      test: /\.m?[jt]sx?$/,
      include: /node_modules\/@mysten/,
      use: [
        {
          loader: require.resolve("./module-resolver.js"),
        },
      ],
    })

    return config
  },
}

export default nextConfig
