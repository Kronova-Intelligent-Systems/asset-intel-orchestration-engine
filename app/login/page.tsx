"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { ArrowRight, Lock, Mail, Github, Apple } from "lucide-react"
import { signInWithOAuth } from "../actions/auth"
import { APPLE_SIGN_IN_ENABLED } from "@/lib/auth-providers"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClientSupabaseClient()

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (signInError) {
        throw signInError
      }

      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single()

        if (profileError && profileError.code === "PGRST116") {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: data.user.id,
            user_id: data.user.id,
            full_name: data.user.user_metadata?.full_name || "",
            email: data.user.email,
            company: data.user.user_metadata?.company || "",
            job_title: data.user.user_metadata?.job_title || "",
            website: data.user.user_metadata?.website || "",
            linkedin_url: data.user.user_metadata?.linkedin_url || "",
            username: (data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "user")
              .toLowerCase()
              .replace(/\s+/g, "_"),
            updated_at: new Date().toISOString(),
          })

          if (insertError) {
            console.error("Error creating profile post-login:", insertError)
            toast({
              title: "Profile Creation Issue",
              description: "Could not automatically create your profile. Please update it manually.",
              variant: "warning",
            })
          }
        } else if (profileError) {
          console.error("Error fetching profile post-login:", profileError)
          toast({
            title: "Profile Check Issue",
            description: "There was an issue checking your profile information.",
            variant: "warning",
          })
        }
      }

      toast({
        title: "Login successful",
        description: "Welcome back! Redirecting...",
      })

      window.location.href = "/ai-suite"
    } catch (error) {
      console.error("Error logging in:", error)
      const errorMessage =
        error instanceof Error && (error as any).message
          ? (error as any).message
          : "Invalid email or password. Please try again."
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "google" | "github" | "apple") => {
    setIsLoading(true)
    try {
      const result = await signInWithOAuth(provider)
      if (result.error) {
        throw new Error(result.error)
      }
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error("OAuth error:", error)
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Could not sign in with OAuth",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 tech-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />
{/*
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-2 lg:px-2">
          <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105">
            <Image
              src="/logos/kronova-logo-header.svg"
              alt="Kronova"
              width={180}
              height={40}
              className="h-6 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">New to Kronova?</span>
            <Link href="/signup" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </header>
      */}

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="glass-morphism rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="mb-8 text-center">
              <Link href="/" className="inline-flex items-center justify-center mb-6 transition-opacity hover:opacity-80">
                <Image
                  src="/logos/kronova-logo-footer.svg"
                  alt="Kronova"
                  width={200}
                  height={44}
                  className="h-11 w-auto"
                  priority
                />
              </Link>
              <h1 className="mb-2 font-sans text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to access your enterprise platform</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className={APPLE_SIGN_IN_ENABLED ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                aria-label="Continue with Google"
                onClick={() => handleOAuthSignIn("google")}
                className="bg-background/50 border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                aria-label="Continue with GitHub"
                onClick={() => handleOAuthSignIn("github")}
                className="bg-background/50 border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
              >
                <Github className="h-5 w-5" />
              </Button>

              {APPLE_SIGN_IN_ENABLED && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  aria-label="Continue with Apple"
                  onClick={() => handleOAuthSignIn("apple")}
                  className="bg-background/50 border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
                >
                  <Apple className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                  Create one now
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span>Secure</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.5s" }} />
              <span>Encrypted</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "1s" }} />
              <span>Enterprise</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
