"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createSuiClient, SNS_PACKAGE_ID, SNS_REGISTRY_ID } from "@/lib/sui-client"
import { Transaction } from "@mysten/sui/transactions" // Ensure this is Transaction
import { revalidatePath } from "next/cache"

interface MintSuiNFTProps {
  name: string
  description: string
  imageUrl: string
  websiteUrl?: string
  userId: string
}

/**
 * Server action to mint a Sui NFT.
 * This is a more generic minting function that could be called from various server-side contexts.
 * Note: For user-initiated mints, the client-side approach in SuiNFTMintModal is preferred
 * as it involves the user's connected wallet for signing.
 * This server action would typically be used for backend-initiated mints if applicable,
 * or if a server wallet/keypair were to sign (not implemented here for security).
 */
export async function mintSuiNFT(props: MintSuiNFTProps) {
  const { name, description, imageUrl, websiteUrl, userId } = props
  // const supabase = await createServerSupabaseClient(); // Supabase client not used in this version

  if (!SNS_PACKAGE_ID || !SNS_REGISTRY_ID) {
    console.error("MintSuiNFT Error: SNS_PACKAGE_ID or SNS_REGISTRY_ID is not configured.")
    return {
      success: false,
      error: "Smart contract configuration error. Please contact support.",
    }
  }

  try {
    const suiClient = createSuiClient()
    const tx = new Transaction() // Use new Transaction()

    tx.moveCall({
      target: `${SNS_PACKAGE_ID}::business_card_nft::mint`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(imageUrl),
        tx.pure.string(websiteUrl || ""),
        tx.object(SNS_REGISTRY_ID),
      ],
    })

    tx.setGasBudget(10_000_000)

    // For server-side actions, actual signing and execution would require a server keypair.
    // This example focuses on building and dry-running.
    const dryRunResult = await suiClient.dryRunTransaction({
      transaction: tx.serialize(), // Serialize for dryRunTransactionBlock
    })

    console.log("MintSuiNFT Dry Run Result:", JSON.stringify(dryRunResult, null, 2))

    if (dryRunResult.effects.status.status !== "success") {
      throw new Error(`Dry run failed: ${dryRunResult.effects.status.error || "Unknown error"}`)
    }

    // Simulate success for now as server-side signing isn't implemented
    const simulatedObjectId = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`
    const simulatedTxDigest = dryRunResult.digest

    // Optionally record this simulated mint
    // await recordSuiMint({ /* ... details ... */ });

    revalidatePath("/dashboard")
    return {
      success: true,
      objectId: simulatedObjectId,
      txDigest: simulatedTxDigest,
      message: "NFT mint dry run successful (simulated execution).",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
    console.error("Error in mintSuiNFT server action:", errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

interface RecordSuiMintProps {
  name: string
  description: string
  imageUrl: string
  walletAddress: string
  userId: string
  objectId: string
  txDigest: string
}

/**
 * Server action to record the details of a successfully minted Sui NFT
 * into the application's database.
 */
export async function recordSuiMint(props: RecordSuiMintProps) {
  const supabase = await createServerSupabaseClient()
  const { name, description, imageUrl, walletAddress, userId, objectId, txDigest } = props

  try {
    const { data, error } = await supabase
      .from("sui_nfts")
      .insert({
        user_id: userId,
        name: name,
        description: description,
        image_url: imageUrl,
        wallet_address: walletAddress,
        object_id: objectId,
        tx_hash: txDigest,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    console.log("Successfully recorded Sui NFT mint in DB:", data)

    revalidatePath("/dashboard") // Or relevant path
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
    console.error("Error in recordSuiMint:", error)
    return { success: false, error: errorMessage }
  }
}
