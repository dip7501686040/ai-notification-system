"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { useTenant } from "@/lib/tenant-context";
import { useNotificationStats } from "@/lib/hooks/use-analytics";
import { useNotifications } from "@/lib/hooks/use-notifications";

export default function OverviewPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id;

  const { data: stats, isLoading: statsLoading } = useNotificationStats(tenantId, 30);
  const { data: notifications, isLoading: notificationsLoading } = useNotifications(tenantId);
  const recent = (notifications?.list ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          A quick look at what&apos;s happening in {activeTenant?.name}.
        </p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Sent (30d)" value={String(stats?.totalSent ?? 0)} />
          <StatTile label="Failed (30d)" value={String(stats?.totalFailed ?? 0)} />
          <StatTile
            label="Success rate"
            value={`${Math.round((stats?.successRate ?? 0) * 100)}%`}
          />
          <StatTile
            label="Estimated cost (30d)"
            value={`$${(stats?.totalEstimatedCost ?? 0).toFixed(4)}`}
          />
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent notifications</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/notifications">
              View all
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {notificationsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : recent.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recent.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {notification.channel}
                      </Badge>
                      <StatusBadge status={notification.status} />
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {notification.payload.subject ??
                        notification.payload.body ??
                        "To " + notification.target}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet. Create a rule and send a matching event to see one arrive.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
