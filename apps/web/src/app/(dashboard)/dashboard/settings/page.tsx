"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import {
  useAddMember,
  useDeleteTenant,
  useRemoveMember,
  useTenantMembers,
  useUpdateMemberRole,
  useUpdateTenant,
} from "@/lib/hooks/use-tenants";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { TenantRole } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeTenant, activeRole, setActiveTenantId } = useTenant();
  const tenantId = activeTenant!.id;
  const canManage = activeRole === "owner" || activeRole === "admin";
  const isOwner = activeRole === "owner";

  const [name, setName] = useState(activeTenant!.name);
  useEffect(() => setName(activeTenant!.name), [activeTenant]);

  const updateTenant = useUpdateTenant(tenantId);
  const deleteTenant = useDeleteTenant();
  const { data: members, isLoading: membersLoading } = useTenantMembers(tenantId);
  const addMember = useAddMember(tenantId);
  const updateRole = useUpdateMemberRole(tenantId);
  const removeMember = useRemoveMember(tenantId);

  const [removing, setRemoving] = useState<string | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateTenant.mutateAsync({ name });
      toast.success("Organization updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update organization");
    }
  }

  async function handleRemoveMember() {
    if (!removing) return;
    try {
      await removeMember.mutateAsync(removing);
      toast.success("Member removed");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not remove member");
    }
  }

  async function handleDeleteTenant() {
    try {
      await deleteTenant.mutateAsync(tenantId);
      toast.success("Organization deleted");
      setActiveTenantId("");
      router.push("/tenants");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete organization");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Organization details and team members.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenant-name">Name</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Slug</Label>
              <Input value={activeTenant!.slug} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">
                {format(new Date(activeTenant!.createdAt), "PPP")}
              </p>
            </div>
            {canManage && (
              <Button type="submit" disabled={updateTenant.isPending} className="w-fit">
                {updateTenant.isPending ? "Saving..." : "Save changes"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members</CardTitle>
          {canManage && <AddMemberDialog onSubmit={(values) => addMember.mutateAsync(values)} />}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members && members.list.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.list.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <code className="text-xs">{member.userId}</code>
                      {member.userId === user?.id && (
                        <Badge variant="outline" className="ml-2">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            updateRole.mutate({ userId: member.userId, role: value as TenantRole })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize">
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(member.createdAt), "PP")}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoving(member.userId)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Permanently delete this organization and all of its data.
            </p>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete organization
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title="Remove member"
        description="Are you sure you want to remove this member from the organization?"
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete organization"
        description={`This will permanently delete "${activeTenant!.name}" and all of its data. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteTenant}
      />
    </div>
  );
}
