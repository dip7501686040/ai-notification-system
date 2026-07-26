"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/stat-tile";
import { useTenant } from "@/lib/tenant-context";
import { useDailyEvents, useNotificationStats, useTopSources } from "@/lib/hooks/use-analytics";

const CHART_HUE = "#6d5ef8";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0]!.value} events</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id;
  const [days, setDays] = useState("30");
  const daysNumber = Number(days);

  const { data: dailyEvents, isLoading: eventsLoading } = useDailyEvents(tenantId, daysNumber);
  const { data: topSources, isLoading: sourcesLoading } = useTopSources(tenantId, daysNumber);
  const { data: stats, isLoading: statsLoading } = useNotificationStats(tenantId, daysNumber);

  const chartData = (dailyEvents ?? []).map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    count: d.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Event and notification activity over time.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Sent" value={String(stats?.totalSent ?? 0)} />
          <StatTile label="Failed" value={String(stats?.totalFailed ?? 0)} />
          <StatTile
            label="Success rate"
            value={`${Math.round((stats?.successRate ?? 0) * 100)}%`}
          />
          <StatTile
            label="Estimated cost"
            value={`$${(stats?.totalEstimatedCost ?? 0).toFixed(4)}`}
            hint="Configurable per-channel estimate"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily events</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ left: -20 }}>
                <defs>
                  <linearGradient id="dailyEventsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_HUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_HUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="currentColor" className="text-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_HUE}
                  strokeWidth={2}
                  fill="url(#dailyEventsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top incident sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : topSources && topSources.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topSources} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="currentColor" className="text-border" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={{ fontSize: 12 }}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill={CHART_HUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications by channel</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : stats && stats.byChannel.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byChannel.map((channel) => (
                    <TableRow key={channel.channel}>
                      <TableCell className="capitalize">{channel.channel}</TableCell>
                      <TableCell>{channel.sent}</TableCell>
                      <TableCell>{channel.failed}</TableCell>
                      <TableCell>${channel.estimatedCost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
