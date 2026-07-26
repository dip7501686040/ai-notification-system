"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Bell, Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/lib/tenant-context";
import { useMarkNotificationRead, useNotifications } from "@/lib/hooks/use-notifications";
import { useNotificationSocket } from "@/lib/hooks/use-notification-socket";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const SOCKET_STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting...",
  connected: "Live",
  disconnected: "Disconnected",
};

const SOCKET_STATUS_DOT: Record<string, string> = {
  connecting: "bg-warning",
  connected: "bg-success animate-pulse",
  disconnected: "bg-destructive",
};

export default function NotificationsPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id;
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications(tenantId);
  const markRead = useMarkNotificationRead(tenantId);

  const handleLiveNotification = useCallback(() => {
    toast.success("New notification received");
    void queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] });
  }, [queryClient, tenantId]);

  const socketStatus = useNotificationSocket(tenantId, handleLiveNotification);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Delivered notifications for your organization, updated live.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
          <span className={cn("size-2 rounded-full", SOCKET_STATUS_DOT[socketStatus])} />
          {SOCKET_STATUS_LABEL[socketStatus]}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data && data.list.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.list.map((notification) => (
            <Card
              key={notification.id}
              className={cn(notification.readStatus === "unread" && "border-primary/40")}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Bell className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {notification.channel}
                    </Badge>
                    <StatusBadge status={notification.status} />
                    {notification.readStatus === "unread" && (
                      <Circle className="size-2 fill-primary text-primary" />
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    To {notification.target}
                  </p>
                  {notification.payload.subject && (
                    <p className="mt-1 text-sm font-medium">{notification.payload.subject}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {notification.payload.body ?? JSON.stringify(notification.payload)}
                  </p>
                </div>
                {notification.readStatus === "unread" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markRead.mutate(notification.id)}
                    disabled={markRead.isPending}
                  >
                    <Check />
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notifications yet. Create a rule with a dashboard action and send a matching event to
          see one arrive live.
        </p>
      )}
    </div>
  );
}
