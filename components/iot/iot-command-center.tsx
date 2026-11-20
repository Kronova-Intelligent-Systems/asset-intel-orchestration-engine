"use client"

import { Bluetooth, Radar, RefreshCw, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIoTSnapshot } from "@/lib/hooks/use-iot-command"
import { BluetoothSettlementTab } from "./bluetooth-settlement-tab"
import { CriticalInfrastructureTab } from "./critical-infrastructure-tab"
import { DevicesTab } from "./devices-tab"
import { SampleDataNotice } from "./iot-ui"
import { OverviewTab } from "./overview-tab"

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading devices">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function IoTCommandCenter() {
  const { data, isLoading, isValidating, mutate } = useIoTSnapshot()

  return (
    <div className="min-h-screen flex-1 space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Radar className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">IoT Command Center</h1>
            <p className="text-sm text-muted-foreground">
              Devices, critical infrastructure and proximity settlement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <Badge variant="outline" className="gap-2 font-normal">
              <span
                className={`h-2 w-2 rounded-full ${data.isSample ? "bg-amber-500" : "animate-pulse bg-emerald-500"}`}
                aria-hidden="true"
              />
              {data.isSample ? "Sample data" : "Live"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isValidating ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      {data?.isSample && <SampleDataNotice reason={data.sampleReason} />}

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="critical" className="gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Critical infrastructure
              </TabsTrigger>
              <TabsTrigger value="settlement" className="gap-1.5">
                <Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />
                Bluetooth settlement
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewTab snapshot={data} />
          </TabsContent>
          <TabsContent value="devices">
            <DevicesTab snapshot={data} />
          </TabsContent>
          <TabsContent value="critical">
            <CriticalInfrastructureTab snapshot={data} />
          </TabsContent>
          <TabsContent value="settlement">
            <BluetoothSettlementTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
