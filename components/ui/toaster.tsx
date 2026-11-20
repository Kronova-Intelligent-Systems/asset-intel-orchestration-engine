'use client'

// The app's toast hook (`@/hooks/use-toast`) is backed by Sonner, so the
// Radix-based Toaster that used to live here can no longer be driven by it.
export { Toaster } from '@/components/ui/sonner'
