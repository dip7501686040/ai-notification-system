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
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/lib/hooks/use-templates";
import { TemplateFormDialog } from "@/components/template-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { Template } from "@/lib/types";

export default function TemplatesPage() {
  const { activeTenant, activeRole } = useTenant();
  const tenantId = activeTenant!.id;
  const canManage = activeRole === "owner" || activeRole === "admin";

  const { data, isLoading } = useTemplates(tenantId);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(tenantId);
  const deleteTemplate = useDeleteTemplate(tenantId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | undefined>(undefined);
  const [deleting, setDeleting] = useState<Template | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  async function handleSubmit(values: {
    name: string;
    channel: string;
    subject?: string;
    body: string;
  }) {
    if (editing) {
      await updateTemplate.mutateAsync({ id: editing.id, ...values });
      toast.success("Template updated");
    } else {
      await createTemplate.mutateAsync({ tenantId, ...values });
      toast.success("Template created");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteTemplate.mutateAsync(deleting.id);
      toast.success("Template deleted");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete template");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Render real content into notifications instead of raw event data.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              openCreate();
            }}
          >
            <Plus />
            New template
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
              <TableHead>Channel</TableHead>
              <TableHead>Subject</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {template.channel}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {template.subject || "—"}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(template);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(template)}>
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
          No templates yet. {canManage && "Create one to render real content into notifications."}
        </p>
      )}

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete template"
        description={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
