"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useRotateApiKey,
} from "@/lib/hooks/use-api-keys";
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog";
import { RevealApiKeyDialog } from "@/components/reveal-api-key-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { ApiKey } from "@/lib/types";

export default function ApiKeysPage() {
  const { activeTenant, activeRole } = useTenant();
  const tenantId = activeTenant!.id;
  const canManage = activeRole === "owner" || activeRole === "admin";

  const { data, isLoading } = useApiKeys(tenantId);
  const createApiKey = useCreateApiKey(tenantId);
  const rotateApiKey = useRotateApiKey(tenantId);
  const revokeApiKey = useRevokeApiKey(tenantId);

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | undefined>(undefined);

  async function handleRotate(id: string) {
    try {
      const result = await rotateApiKey.mutateAsync(id);
      setRevealedKey(result.rawKey);
      toast.success("API key rotated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not rotate key");
    }
  }

  async function handleRevoke() {
    if (!revoking) return;
    try {
      await revokeApiKey.mutateAsync(revoking.id);
      toast.success("API key revoked");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not revoke key");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Authenticate <code className="text-xs">POST /events</code> requests with an{" "}
            <code className="text-xs">X-API-Key</code> header instead of a user token.
          </p>
        </div>
        {canManage && (
          <CreateApiKeyDialog
            onCreate={(values) => createApiKey.mutateAsync(values)}
            onCreated={(result) => setRevealedKey(result.rawKey)}
          />
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
              <TableHead>Key</TableHead>
              <TableHead>Rate limit</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.list.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>
                  <code className="text-xs text-muted-foreground">{key.keyPrefix}...</code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{key.rateLimit}/min</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {key.lastUsedAt
                    ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                    : "Never"}
                </TableCell>
                <TableCell>
                  <Badge variant={key.revoked ? "destructive" : "success"}>
                    {key.revoked ? "Revoked" : "Active"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    {!key.revoked && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={rotateApiKey.isPending}
                          onClick={() => handleRotate(key.id)}
                          title="Rotate"
                        >
                          <RotateCw />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRevoking(key)}
                          title="Revoke"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No API keys yet.{" "}
          {canManage && "Create one to authenticate event ingestion outside the dashboard."}
        </p>
      )}

      <RevealApiKeyDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title="Revoke API key"
        description={`Are you sure you want to revoke "${revoking?.name}"? Any integration using this key will stop working immediately.`}
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
