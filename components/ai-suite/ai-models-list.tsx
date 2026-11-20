"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AIModel {
  id: string
  name: string
  description: string
  provider: string
  cost_per_1k_tokens?: number
  model_id: string
  capabilities: string[]
}

interface AIModelsListProps {
  models: AIModel[]
}

export function AIModelsList({ models }: AIModelsListProps) {
  return (
    <div className="space-y-4">
      {models
        .sort((a, b) => {
          const getModelPriority = (model: AIModel) => {
            if (model.model_id.includes("gpt-5")) return 1000
            if (model.model_id.includes("gpt-4.1")) return 900
            if (model.model_id.includes("gpt-4o")) return 800
            if (model.model_id.includes("gpt-4")) return 700
            if (model.model_id.includes("claude-3.5")) return 600
            if (model.model_id.includes("claude-3")) return 500
            return 0
          }
          return getModelPriority(b) - getModelPriority(a)
        })
        .map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {model.name}
                {(model.model_id.includes("gpt-5") || model.model_id.includes("gpt-4.1")) && (
                  <Badge className="bg-green-100 text-green-800">NEW</Badge>
                )}
              </CardTitle>
              <CardDescription>{model.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge className="bg-muted text-muted-foreground">{model.provider}</Badge>
                {model.cost_per_1k_tokens != null && (
                  <p className="text-sm text-muted-foreground">
                    Cost: ${Number(model.cost_per_1k_tokens).toFixed(3)} / 1k tokens
                  </p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {model.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline" className="text-xs">
                    {capability}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
