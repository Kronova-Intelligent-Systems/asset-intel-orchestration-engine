"use server"

import { create } from "ipfs-http-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Configure IPFS client with Infura or other IPFS provider
const projectId = process.env.INFURA_IPFS_PROJECT_ID
const projectSecret = process.env.INFURA_IPFS_PROJECT_SECRET
const auth = `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString("base64")}`

const ipfsClient = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
})

// Fallback to Supabase storage if IPFS credentials are not available
export async function uploadToIPFS(file: Buffer, fileName: string): Promise<string> {
  try {
    // Try IPFS first if credentials are available
    if (projectId && projectSecret) {
      const result = await ipfsClient.add(file)
      return `ipfs://${result.cid.toString()}`
    } else {
      // Fallback to Supabase storage
      return await uploadToSupabase(file, fileName)
    }
  } catch (error) {
    console.error("Error uploading to IPFS:", error)
    // Fallback to Supabase storage
    return await uploadToSupabase(file, fileName)
  }
}

async function uploadToSupabase(file: Buffer, fileName: string): Promise<string> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.storage.from("nft-assets").upload(`assets/${fileName}`, file, {
    contentType: "application/octet-stream",
    upsert: true,
  })

  if (error) {
    console.error("Error uploading to Supabase:", error)
    throw new Error("Failed to upload file to storage")
  }

  const { data: urlData } = supabase.storage.from("nft-assets").getPublicUrl(`assets/${fileName}`)

  return urlData.publicUrl
}

export async function uploadMetadata(metadata: any): Promise<string> {
  try {
    const metadataBuffer = Buffer.from(JSON.stringify(metadata))

    if (projectId && projectSecret) {
      const result = await ipfsClient.add(metadataBuffer)
      return `ipfs://${result.cid.toString()}`
    } else {
      // Fallback to Supabase storage
      const fileName = `metadata-${Date.now()}.json`
      return await uploadToSupabase(metadataBuffer, fileName)
    }
  } catch (error) {
    console.error("Error uploading metadata:", error)
    throw new Error("Failed to upload metadata")
  }
}
