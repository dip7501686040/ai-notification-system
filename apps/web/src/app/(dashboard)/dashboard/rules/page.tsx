"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useCreateRule, useDeleteRule, useRules, useUpdateRule } from "@/lib/hooks/use-rules";
import { RuleFormDialog } from "@/components/rule-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { Rule } from "@/lib/types";

export default function RulesPage() {
  const { activeTenant, activeRole } = useTenant();
  const tenantId = activeTenant!.id;
  const canManage = activeRole === "owner" || activeRole === "admin";

  const { data, isLoading } = useRules(tenantId);
  const createRule = useCreateRule();
  const updateRule = useUpdateRule(tenantId);
  const deleteRule = useDeleteRule(tenantId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined);
  const [deletingRule, setDeletingRule] = useState<Rule | undefined>(undefined);

  function openCreate() {
    setEditingRule(undefined);
    setFormOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule);
    setFormOpen(true);
  }

  async function handleSubmit(values: {
    name: string;
    eventType: string;
    enabled: boolean;
    conditions?: unknown;
    actions: Rule["actions"];
  }) {
    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...values });
      toast.success("Rule updated");
    } else {
      await createRule.mutateAsync({ tenantId, ...values });
      toast.success("Rule created");
    }
  }

  async function handleDelete() {
    if (!deletingRule) return;
    try {
      await deleteRule.mutateAsync(deletingRule.id);
      toast.success("Rule deleted");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete rule");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-muted-foreground">
            Match incoming events and trigger notifications.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus />
            New rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data && data.list.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{rule.eventType}</code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rule.actions.map((action, i) => (
                      <Badge key={i} variant="secondary" className="capitalize">
                        {action.channel}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.enabled ? "success" : "outline"}>
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingRule(rule)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No rules yet. {canManage && "Create one to start routing events to notifications."}
        </p>
      )}

      <RuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editingRule}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={Boolean(deletingRule)}
        onOpenChange={(open) => !open && setDeletingRule(undefined)}
        title="Delete rule"
        description={`Are you sure you want to delete "${deletingRule?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
