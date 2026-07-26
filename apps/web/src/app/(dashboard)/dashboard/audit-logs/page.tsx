"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useTenant } from "@/lib/tenant-context";
import { useAuditLogs } from "@/lib/hooks/use-audit-logs";

export default function AuditLogsPage() {
  const { activeTenant, activeRole } = useTenant();
  const [action, setAction] = useState("");
  const [days, setDays] = useState("30");
  const canView = activeRole === "owner" || activeRole === "admin";

  const { data, isLoading } = useAuditLogs(
    canView ? activeTenant?.id : undefined,
    action || undefined,
    Number(days),
  );

  if (!canView) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            A record of activity in your organization.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-12 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Ask an admin</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Audit logs are only visible to organization owners and admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            A record of activity in your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by action..."
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-48"
          />
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
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data && data.list.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.targetType ? (
                    <>
                      <span className="capitalize">{log.targetType}</span>{" "}
                      <code className="text-xs">{log.targetId.slice(0, 8)}</code>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <code className="text-xs">{log.actorId.slice(0, 8)}</code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No audit activity found for this range.
        </p>
      )}
    </div>
  );
}
