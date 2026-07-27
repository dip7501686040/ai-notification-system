import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ObservabilityLinks } from "@/lib/types";

export function useObservabilityLinks(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", "observability-links", tenantId],
    queryFn: () =>
      apiFetch<ObservabilityLinks>("/analytics/observability-links", { query: { tenantId } }),
    enabled: Boolean(tenantId),
  });
}
