"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { PublicProfileCard } from "@/components/public-profile-card"

// Create a direct Supabase client without auth
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      setResolvedParams(resolved)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!resolvedParams) return

    async function fetchProfile() {
      try {
        console.log("Fetching profile with public_id:", resolvedParams.id)

        // Query the column-limited public view instead of the profiles table directly,
        // so this page can never receive sensitive fields (stripe_customer_id, waddress,
        // username, etc.) even via a future select("*").
        const { data, error } = await supabase
          .from("public_profile_cards")
          .select("*")
          .eq("public_id", resolvedParams.id)
          .single()

        if (error) {
          console.error("Error fetching profile:", error)
          throw new Error("Profile not found")
        }

        if (!data) {
          console.error("Profile not found with public_id:", resolvedParams.id)
          throw new Error("Profile not found")
        }

        console.log("Successfully found profile:", data)
        setProfile(data)
      } catch (err) {
        console.error("Error:", err)
        setError(err instanceof Error ? err.message : "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [resolvedParams])

  if (loading || !resolvedParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading business card...</p>
          {resolvedParams && (
            <p className="text-sm text-gray-500 mt-2">Public ID: {resolvedParams.id.substring(0, 6)}...</p>
          )}
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Business Card Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "The business card you're looking for could not be found."}</p>
          <Link
            href="/"
            className="inline-block bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Kronova</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">{profile.full_name}'s Business Card</h2>

          <PublicProfileCard profile={profile} />
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 py-4 px-6 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Kronova. All rights reserved.</p>
      </footer>
    </div>
  )
}
