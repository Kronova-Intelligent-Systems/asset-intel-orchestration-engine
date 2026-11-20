"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createSuiClient } from "@/lib/sui-client"
import { Transaction } from "@mysten/sui/transactions"
import { redirect } from "next/navigation"

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

// Mint Sui NFT function (on blockchain)
export async function mintSuiNFT(profileId: string, name: string, description: string, imageUrl: string) {
  const supabase = await createServerSupabaseClient()

  // Get the user's session
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    redirect("/login")
  }

  // Get the user's wallet address
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("waddress")
    .eq("id", profileId)
    .single()

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError)
    return { success: false, error: "Failed to fetch profile" }
  }

  if (!profile.waddress) {
    return { success: false, error: "No wallet address found for this profile" }
  }

  try {
    // Create a Sui client
    const suiClient = createSuiClient()

    // Create a transaction block
    const tx = new Transaction()

    // Prepare the NFT data
    const nftName = name || "NFT"
    const nftDescription = description || "Kronova Digital ID NFT"
    const nftUrl = imageUrl || "https://app.kronova.io/images/kronova-icon.png"

    // Call the mint function on the NFT contract
    // This is a simplified example - you'll need to replace with your actual contract details
    tx.moveCall({
      target: `0x2::devnet_nft::mint`,
      arguments: [tx.pure(nftName), tx.pure(nftDescription), tx.pure(nftUrl)],
    })

    // Set the gas budget
    tx.setGasBudget(10000000)

    // Sign and execute the transaction
    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    })

    console.log("Minted NFT:", result)

    // Extract the NFT ID from the transaction result
    const nftId = result.effects?.created?.[0]?.reference?.objectId

    if (!nftId) {
      return { success: false, error: "Failed to extract NFT ID from transaction" }
    }

    // Save the NFT information to the database
    const { data: nftData, error: nftError } = await supabase
      .from("sui_nfts")
      .insert({
        profile_id: profileId,
        object_id: nftId,
        name: nftName,
        description: nftDescription,
        image_url: nftUrl,
        transaction_digest: result.digest,
      })
      .select()
      .single()

    if (nftError) {
      console.error("Error saving NFT to database:", nftError)
      return { success: true, nftId, warning: "NFT minted but failed to save to database" }
    }

    return { success: true, nftId, nftData }
  } catch (error) {
    console.error("Error minting NFT:", error)
    return { success: false, error: `Failed to mint NFT: ${error instanceof Error ? error.message : String(error)}` }
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
