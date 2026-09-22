"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Zap, Network, ShieldCheck, BrainCircuit, Bot, Sparkles, Database, Lock } from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  }

  const hexagons = [
    { label: "AI-DRIVEN\nANALYTICS", icon: BrainCircuit, delay: 0.2 },
    { label: "COGNITIVE\nAGENTS", icon: Bot, delay: 0.3 },
    { label: "REAL-TIME\nINTELLIGENCE", icon: Sparkles, delay: 0.4 },
    { label: "SECURE DATA\nHANDLING", icon: Lock, delay: 0.5 },
    { label: "OPTIMIZED\nINTEGRATIONS", icon: Network, delay: 0.6 },
    { label: "INTELLIGENT\nREPORTING", icon: Database, delay: 0.7 },
  ]

  return (
    <section className="relative w-full min-h-screen flex flex-col overflow-hidden bg-background">
      {/* Tech grid background */}
      <div className="absolute inset-0 tech-grid opacity-20" />
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      {/* Header Logo */}
      <motion.div 
        className="container px-4 md:px-6 mx-auto pt-6 md:pt-8 relative z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.6 } }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logos/kronova-logo-icon.svg"
            alt="Kronova"
            width={48}
            height={48}
            className="h-10 w-10 md:h-12 md:w-12"
            priority
          />
          <div>
            <h2 className="text-sm font-semibold tracking-wider text-primary uppercase">KRONOVA</h2>
            <p className="text-xs text-muted-foreground">INTELLIGENT SYSTEMS</p>
          </div>
        </div>
      </motion.div>

      {/* Centered Hero Content */}
      <div className="container px-4 md:px-6 mx-auto relative z-10 flex-1 flex items-center justify-center py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center w-full">
          {/* Left Column: Content */}
          <motion.div
            className="flex flex-col justify-center space-y-6 md:space-y-8"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          >

            <motion.div variants={fadeIn} className="space-y-4 md:space-y-5">
              <Badge variant="outline" className="py-2 px-4 border-primary/60 text-primary bg-primary/10 text-sm font-semibold inline-flex items-center gap-2">
                <Zap className="w-4 h-4" />
                UNLEASHING REAL-TIME INTELLIGENCE
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl !leading-tight text-balance">
                <span className="block text-foreground">Transforming Data</span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary mt-2">
                  Into Actionable Insight
                </span>
              </h1>
            </motion.div>

            <motion.p variants={fadeIn} className="max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
              The only platform utilizing a sovereign, cloud agnostic, post-quantum-secure, zero-trust, new-era mainframe to secure mission-critical, intelligent M2M commerce, AI token commoditization, RWA tokenization, MCP payloads, institutional AP2 payments and escrows, and stablecoin transfers and issuance — while assuring regulatory compliance, from silicon to private settlement.
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold shadow-lg shadow-primary/30 hover:shadow-xl transition-all group">
                <Link href="/signup">
                  Get Started <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary/60 bg-transparent">
                <Link href="/login">
                  Sign In
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right Column: Hexagonal Platform Visualization */}
          <motion.div
            className="relative h-[500px] md:h-[600px] lg:h-[650px] hidden lg:flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.8, delay: 0.2 } }}
          >
            {/* Central Kronova Platform Hexagon */}
            <motion.div
              className="absolute z-10"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0, transition: { duration: 0.8, delay: 0.4 } }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-2xl blur-2xl opacity-40 animate-pulse" />
                <div className="relative glass-morphism border-2 border-primary/50 rounded-2xl p-8 w-56 h-56 flex flex-col items-center justify-center shadow-2xl">
                  <Image
                    src="/logos/kronova-logo-icon.svg"
                    alt="Kronova Platform"
                    width={80}
                    height={80}
                    className="mb-4 drop-shadow-lg"
                  />
                  <h3 className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-br from-primary to-accent">
                    KRONOVA
                  </h3>
                  <p className="text-xs text-center text-muted-foreground mt-1 font-semibold">PLATFORM</p>
                </div>
              </div>
            </motion.div>

            {/* Surrounding Hexagons */}
            {hexagons.map((hex, index) => {
              const angle = (index * 60) * (Math.PI / 180)
              const radius = 220
              const x = Math.cos(angle) * radius
              const y = Math.sin(angle) * radius

              return (
                <motion.div
                  key={index}
                  className="absolute"
                  style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1, transition: { duration: 0.5, delay: hex.delay } }}
                >
                  <div className="relative group">
                    {/* Connection line */}
                    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" width={Math.abs(x) * 2} height={Math.abs(y) * 2}>
                      <line
                        x1={x > 0 ? 0 : Math.abs(x) * 2}
                        y1={y > 0 ? 0 : Math.abs(y) * 2}
                        x2={Math.abs(x)}
                        y2={Math.abs(y)}
                        stroke="url(#line-gradient)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="animate-data-flow"
                      />
                      <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.6" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Hexagon node */}
                    <div className="glass-morphism border border-primary/30 rounded-lg p-4 w-32 h-32 flex flex-col items-center justify-center transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20 hover:scale-105">
                      <hex.icon className="w-8 h-8 text-primary mb-2" />
                      <p className="text-[10px] text-center font-semibold text-foreground leading-tight whitespace-pre-line">
                        {hex.label}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
