"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllTenants, useSetTenantStatus } from "@/lib/hooks/use-admin-tenants";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { Tenant } from "@/lib/types";

export default function AdminTenantsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAllTenants(search);
  const setStatus = useSetTenantStatus();
  const [pending, setPending] = useState<
    { tenant: Tenant; next: "active" | "suspended" } | undefined
  >(undefined);

  async function handleConfirm() {
    if (!pending) return;
    try {
      await setStatus.mutateAsync({ id: pending.tenant.id, status: pending.next });
      toast.success(
        `${pending.tenant.name} ${pending.next === "suspended" ? "suspended" : "reactivated"}`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update tenant status");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All tenants</h1>
          <p className="text-sm text-muted-foreground">
            Every organization on the platform, regardless of your own membership.
          </p>
        </div>
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
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
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{tenant.slug}</TableCell>
                <TableCell className="capitalize text-sm text-muted-foreground">
                  {tenant.plan}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={tenant.status === "suspended" ? "warning" : "success"}
                    className="capitalize"
                  >
                    {tenant.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(tenant.createdAt), "PP")}
                </TableCell>
                <TableCell>
                  {tenant.status === "suspended" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ tenant, next: "active" })}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setPending({ tenant, next: "suspended" })}
                    >
                      Suspend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No tenants found.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={pending?.next === "suspended" ? "Suspend tenant" : "Reactivate tenant"}
        description={
          pending?.next === "suspended"
            ? `Suspending "${pending?.tenant.name}" will block all API and dashboard access for its members.`
            : `Reactivate "${pending?.tenant.name}" and restore access for its members.`
        }
        confirmLabel={pending?.next === "suspended" ? "Suspend" : "Reactivate"}
        destructive={pending?.next === "suspended"}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
