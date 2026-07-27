"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/lib/tenant-context";
import { useObservabilityLinks } from "@/lib/hooks/use-observability";

// Grafana/Jaeger do the actual charting -- these are just tenant-locked
// embeds (see analytics.service.ts's getObservabilityLinks on the
// backend), not custom dashboards built here.
function EmbedFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      className="h-[80vh] w-full rounded-md border-0"
      referrerPolicy="no-referrer"
    />
  );
}

export default function ObservabilityPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id;
  const { data: links, isLoading } = useObservabilityLinks(tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Observability</h1>
        <p className="text-sm text-muted-foreground">
          Requests, errors, logs, and traces for your tenant.
        </p>
      </div>

      {isLoading || !links ? (
        <Skeleton className="h-[80vh] w-full" />
      ) : (
        <Tabs defaultValue="metrics">
          <TabsList>
            <TabsTrigger value="metrics">Metrics &amp; Errors</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="traces">Traces</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <Card>
              <CardContent className="p-2">
                <EmbedFrame src={links.metricsLogsUrl} title="Request &amp; error metrics" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="p-2">
                <EmbedFrame src={`${links.metricsLogsUrl}&viewPanel=4`} title="Logs" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="traces">
            <Card>
              <CardContent className="p-2">
                <EmbedFrame src={links.tracesUrl} title="Distributed traces" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <Card>
              <CardContent className="p-2">
                <EmbedFrame src={links.systemHealthUrl} title="System health" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
