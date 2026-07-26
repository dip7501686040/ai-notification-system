"use client";

import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/lib/tenant-context";
import { useEvents } from "@/lib/hooks/use-events";
import { SendEventDialog } from "@/components/send-event-dialog";
import { StatusBadge } from "@/components/status-badge";

export default function EventsPage() {
  const { activeTenant } = useTenant();
  const { data, isLoading } = useEvents(activeTenant?.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Raw events ingested from your applications and monitoring tools.
          </p>
        </div>
        <SendEventDialog />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data && data.list.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  <code className="text-xs">{event.type}</code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {event.source || "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={event.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No events yet. Send a test event or point your applications at the ingestion API.
        </p>
      )}
    </div>
  );
}
