import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AuditLog, Paginated } from "@/lib/types";

export function useAuditLogs(tenantId: string | undefined, action: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["audit-logs", tenantId, action, days],
    queryFn: () =>
      apiFetch<Paginated<AuditLog>>("/audit-logs", {
        query: { tenantId, action, days, limit: 100 },
      }),
    enabled: Boolean(tenantId),
  });
}
