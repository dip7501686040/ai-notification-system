"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/lib/tenant-context";
import { useAiConfig, useEventAnalyses, useSetAiConfig } from "@/lib/hooks/use-ai";
import { AiConfigForm } from "@/components/ai-config-form";
import { StatusBadge } from "@/components/status-badge";

const SEVERITY_VARIANTS: Record<string, "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
  critical: "destructive",
};

export default function AiPage() {
  const { activeTenant, activeRole } = useTenant();
  const tenantId = activeTenant!.id;
  const canManage = activeRole === "owner" || activeRole === "admin";

  const { data: analyses, isLoading: analysesLoading } = useEventAnalyses(tenantId);
  const { data: config, isLoading: configLoading } = useAiConfig(tenantId);
  const setAiConfig = useSetAiConfig(tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">AI</h1>
        <p className="text-sm text-muted-foreground">
          Automated event analysis and the provider used to generate it.
        </p>
      </div>

      <Tabs defaultValue="analyses">
        <TabsList>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="analyses">
          {analysesLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : analyses && analyses.list.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.list.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell className="font-medium">
                      <code className="text-xs">{analysis.type}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {analysis.category || "—"}
                    </TableCell>
                    <TableCell>
                      {analysis.severity ? (
                        <Badge
                          variant={SEVERITY_VARIANTS[analysis.severity] ?? "outline"}
                          className="capitalize"
                        >
                          {analysis.severity}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
                      {analysis.summary || analysis.error || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={analysis.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No AI analyses yet. They&apos;re generated automatically as events come in.
            </p>
          )}
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider &amp; model</CardTitle>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <Skeleton className="h-32 w-full max-w-md" />
              ) : (
                <AiConfigForm
                  config={config}
                  readOnly={!canManage}
                  onSubmit={(values) => setAiConfig.mutateAsync(values)}
                />
              )}
              {!canManage && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Only owners and admins can change the AI provider configuration.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
