/**
 * Canton Blockchain Client
 *
 * Enterprise-grade integration with Digital Asset's Canton Network
 * Using the JSON Ledger API for Daml smart contract interactions
 *
 * Reference: https://docs.digitalasset.com/build/3.5/reference/app-dev/index.html
 */

import { z } from "zod"

// ==================== Configuration ====================

export interface CantonConfig {
  ledgerApiUrl: string
  ledgerApiToken?: string
  applicationId: string
  partyId: string
  packageId?: string
}

const DEFAULT_CONFIG: Partial<CantonConfig> = {
  ledgerApiUrl: process.env.CANTON_LEDGER_API_URL || "https://canton.kronova.io/api/ledger",
  applicationId: "kronova-stablecoin",
}

// ==================== Schemas ====================

export const cantonPartySchema = z.object({
  partyId: z.string(),
  displayName: z.string().optional(),
  isLocal: z.boolean().default(true),
})

export const cantonContractSchema = z.object({
  contractId: z.string(),
  templateId: z.string(),
  payload: z.record(z.string(), z.any()),
  signatories: z.array(z.string()),
  observers: z.array(z.string()),
  createdAt: z.string().datetime(),
})

export const stablecoinConfigSchema = z.object({
  name: z.string().min(1, "Stablecoin name is required"),
  symbol: z.string().min(2).max(6, "Symbol must be 2-6 characters"),
  decimals: z.number().int().min(0).max(18).default(6),
  totalSupply: z.string(), // Use string for large numbers
  issuer: z.string(),
  backingType: z.enum(["usdc", "fiat", "multi-collateral", "algorithmic"]),
  collateralRatio: z.number().min(100).default(100), // Minimum 100% backing
  kycRequired: z.boolean().default(true),
  transferRestrictions: z.array(z.enum(["whitelist", "blacklist", "jurisdiction", "amount-limit"])).default([]),
  complianceConfig: z
    .object({
      amlEnabled: z.boolean().default(true),
      sanctionsScreening: z.boolean().default(true),
      jurisdictionRestrictions: z.array(z.string()).default([]),
      maxTransactionAmount: z.string().optional(),
      dailyTransactionLimit: z.string().optional(),
    })
    .default({}),
})

export type CantonParty = z.infer<typeof cantonPartySchema>
export type CantonContract = z.infer<typeof cantonContractSchema>
export type StablecoinConfig = z.infer<typeof stablecoinConfigSchema>

// ==================== Canton Client ====================

export class CantonClient {
  private config: CantonConfig
  private accessToken: string | null = null

  constructor(config: Partial<CantonConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as CantonConfig
  }

  /**
   * Authenticate with Canton Ledger API
   */
  async authenticate(credentials?: { apiKey?: string; jwt?: string }): Promise<boolean> {
    try {
      if (credentials?.jwt) {
        this.accessToken = credentials.jwt
      } else if (credentials?.apiKey) {
        // Exchange API key for JWT token
        const response = await fetch(`${this.config.ledgerApiUrl}/auth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": credentials.apiKey,
          },
          body: JSON.stringify({
            applicationId: this.config.applicationId,
            partyId: this.config.partyId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Authentication failed: ${response.statusText}`)
        }

        const data = await response.json()
        this.accessToken = data.accessToken
      } else if (this.config.ledgerApiToken) {
        this.accessToken = this.config.ledgerApiToken
      }

      return !!this.accessToken
    } catch (error) {
      console.error("[Canton] Authentication error:", error)
      return false
    }
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`
    }

    return headers
  }

  /**
   * Allocate a new party on the Canton ledger
   * Reference: https://docs.digitalasset.com/sdlc-howtos/applications/develop/manage-daml-parties.html
   */
  async allocateParty(displayName: string, partyIdHint?: string): Promise<CantonParty | null> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/parties`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          partyIdHint: partyIdHint || displayName.toLowerCase().replace(/\s+/g, "-"),
          displayName,
          localMetadata: {
            annotations: {
              createdBy: this.config.applicationId,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error("[Canton] Party allocation failed:", error)
        return null
      }

      const data = await response.json()
      return cantonPartySchema.parse({
        partyId: data.partyId,
        displayName: data.localMetadata?.displayName || displayName,
        isLocal: true,
      })
    } catch (error) {
      console.error("[Canton] Error allocating party:", error)
      return null
    }
  }

  /**
   * Upload a Daml package (.dar file)
   * Reference: https://docs.digitalasset.com/sdlc-howtos/applications/develop/manage-daml-packages.html
   */
  async uploadPackage(darFile: ArrayBuffer): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/packages`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/octet-stream",
        },
        body: darFile,
      })

      if (!response.ok) {
        const error = await response.text()
        console.error("[Canton] Package upload failed:", error)
        return null
      }

      const data = await response.json()
      return data.packageId
    } catch (error) {
      console.error("[Canton] Error uploading package:", error)
      return null
    }
  }

  /**
   * Create a contract on the Canton ledger
   */
  async createContract<T extends Record<string, unknown>>(
    templateId: string,
    payload: T,
    signatories?: string[],
  ): Promise<CantonContract | null> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/commands`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          commands: [
            {
              create: {
                templateId: {
                  packageId: this.config.packageId,
                  moduleName: templateId.split(":")[0],
                  entityName: templateId.split(":")[1],
                },
                createArguments: payload,
              },
            },
          ],
          applicationId: this.config.applicationId,
          commandId: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actAs: signatories || [this.config.partyId],
          readAs: [this.config.partyId],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error("[Canton] Contract creation failed:", error)
        return null
      }

      const data = await response.json()
      const createdEvent = data.transaction?.events?.find((e: any) => e.created)

      if (createdEvent?.created) {
        return cantonContractSchema.parse({
          contractId: createdEvent.created.contractId,
          templateId,
          payload,
          signatories: createdEvent.created.signatories || signatories || [this.config.partyId],
          observers: createdEvent.created.observers || [],
          createdAt: new Date().toISOString(),
        })
      }

      return null
    } catch (error) {
      console.error("[Canton] Error creating contract:", error)
      return null
    }
  }

  /**
   * Exercise a choice on a contract
   */
  async exerciseChoice<T extends Record<string, unknown>>(
    contractId: string,
    templateId: string,
    choice: string,
    argument: T,
  ): Promise<any> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/commands`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          commands: [
            {
              exercise: {
                templateId: {
                  packageId: this.config.packageId,
                  moduleName: templateId.split(":")[0],
                  entityName: templateId.split(":")[1],
                },
                contractId,
                choice,
                choiceArgument: argument,
              },
            },
          ],
          applicationId: this.config.applicationId,
          commandId: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actAs: [this.config.partyId],
          readAs: [this.config.partyId],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error("[Canton] Exercise choice failed:", error)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error("[Canton] Error exercising choice:", error)
      return null
    }
  }

  /**
   * Query active contracts
   */
  async queryContracts(templateId: string, filter?: Record<string, unknown>): Promise<CantonContract[]> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/state/acs`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          filter: {
            filtersByParty: {
              [this.config.partyId]: {
                cumulative: [
                  {
                    templateFilters: [
                      {
                        templateId: {
                          packageId: this.config.packageId,
                          moduleName: templateId.split(":")[0],
                          entityName: templateId.split(":")[1],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error("[Canton] Query contracts failed:", error)
        return []
      }

      const data = await response.json()
      return (data.activeContracts || []).map((c: any) =>
        cantonContractSchema.parse({
          contractId: c.contractId,
          templateId,
          payload: c.createArguments || {},
          signatories: c.signatories || [],
          observers: c.observers || [],
          createdAt: c.createdAt || new Date().toISOString(),
        }),
      )
    } catch (error) {
      console.error("[Canton] Error querying contracts:", error)
      return []
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.ledgerApiUrl}/v2/updates/transaction-tree-by-id/${transactionId}`, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error("[Canton] Error getting transaction:", error)
      return null
    }
  }

  /**
   * Subscribe to contract updates via WebSocket
   */
  createContractStream(
    templateId: string,
    onContract: (contract: CantonContract) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const wsUrl = this.config.ledgerApiUrl.replace("https://", "wss://").replace("http://", "ws://")
    const ws = new WebSocket(`${wsUrl}/v2/updates`)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          filter: {
            filtersByParty: {
              [this.config.partyId]: {
                cumulative: [
                  {
                    templateFilters: [
                      {
                        templateId: {
                          packageId: this.config.packageId,
                          moduleName: templateId.split(":")[0],
                          entityName: templateId.split(":")[1],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          beginExclusive: { boundary: "LEDGER_BEGIN" },
        }),
      )
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.transaction?.events) {
          for (const e of data.transaction.events) {
            if (e.created) {
              onContract(
                cantonContractSchema.parse({
                  contractId: e.created.contractId,
                  templateId,
                  payload: e.created.createArguments || {},
                  signatories: e.created.signatories || [],
                  observers: e.created.observers || [],
                  createdAt: new Date().toISOString(),
                }),
              )
            }
          }
        }
      } catch (error) {
        onError?.(error as Error)
      }
    }

    ws.onerror = (error) => {
      onError?.(new Error("WebSocket error"))
    }

    // Return cleanup function
    return () => {
      ws.close()
    }
  }
}

// ==================== Singleton Instance ====================

let cantonClientInstance: CantonClient | null = null

export function getCantonClient(config?: Partial<CantonConfig>): CantonClient {
  if (!cantonClientInstance || config) {
    cantonClientInstance = new CantonClient(config)
  }
  return cantonClientInstance
}
