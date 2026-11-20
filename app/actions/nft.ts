"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Mint NFT function (local database)
export async function mintNFT({ userId, profileId, name }: { userId: string; profileId: string; name: string }) {
  const supabase = await createServerSupabaseClient()

  try {
    // Basic validation
    if (!userId || !profileId || !name) {
      return { success: false, error: "Missing required parameters" }
    }

    // Simulate blockchain transaction
    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`
    const tokenId = Math.floor(Math.random() * 1000000).toString()

    // Create NFT record
    const { data, error } = await supabase
      .from("nfts")
      .insert({
        user_id: userId,
        profile_id: profileId,
        name,
        tx_hash: txHash,
        token_id: tokenId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating NFT:", error)
      return { success: false, error: "Failed to create NFT record" }
    }

    revalidatePath("/dashboard")
    return { success: true, nft: data }
  } catch (error) {
    console.error("Error in mintNFT:", error)
    return {
      success: false,
      error: "An unexpected error occurred while minting your NFT",
    }
  }
}

// Save Sui NFT function
export async function saveSuiNFT({
  userId,
  profileId,
  name,
  objectId,
  txDigest,
  imageUrl,
}: {
  userId: string
  profileId: string
  name: string
  objectId: string
  txDigest: string
  imageUrl?: string
}) {
  const supabase = await createServerSupabaseClient()

  try {
    // Basic validation
    if (!userId || !profileId || !name || !objectId || !txDigest) {
      return { success: false, error: "Missing required parameters" }
    }

    // Create NFT record
    const { data, error } = await supabase
      .from("sui_nfts")
      .insert({
        user_id: userId,
        profile_id: profileId,
        name,
        object_id: objectId,
        tx_digest: txDigest,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating Sui NFT:", error)
      return { success: false, error: "Failed to create Sui NFT record" }
    }

    revalidatePath("/dashboard")
    return { success: true, nft: data }
  } catch (error) {
    console.error("Error in saveSuiNFT:", error)
    return {
      success: false,
      error: "An unexpected error occurred while saving your Sui NFT",
    }
  }
}
