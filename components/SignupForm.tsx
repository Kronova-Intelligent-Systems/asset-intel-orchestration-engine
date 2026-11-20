"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { userSchema } from "@/lib/schemas"
import * as z from "zod"

export default function SignupForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    company: "",
    website: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()

    try {
      // Validate form data
      const validatedData = userSchema.parse(formData)

      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: formData.password,
        options: {
          data: {
            full_name: validatedData.full_name,
            company: validatedData.company,
            website: validatedData.website,
          },
        },
      })

      if (error) throw error

      toast({
        title: "Account created",
        description: "Please check your email to verify your account.",
      })

      router.push("/login")
    } catch (error) {
      console.error("Error signing up:", error)
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "There was an error creating your account. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Enter your information to create your digital business card</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="John Doe"
                required
                value={formData.full_name}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                name="company"
                placeholder="Acme Inc."
                required
                value={formData.company}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Company Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://example.com"
                required
                value={formData.website}
                onChange={handleChange}
              />
              <p className="text-xs text-gray-500">Include https:// or we'll add it for you</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
