import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AiConfig, EventAnalysis, Paginated } from "@/lib/types";

export function useEventAnalyses(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["ai-analyses", tenantId],
    queryFn: () =>
      apiFetch<Paginated<EventAnalysis>>("/ai-analyses", { query: { tenantId, limit: "50" } }),
    enabled: Boolean(tenantId),
  });
}

export function useAiConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["ai-config", tenantId],
    queryFn: () => apiFetch<AiConfig>("/ai-config", { query: { tenantId } }),
    enabled: Boolean(tenantId),
  });
}

export function useSetAiConfig(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; model: string }) =>
      apiFetch<AiConfig>("/ai-config", { method: "PUT", body: { tenantId, ...data } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-config", tenantId] });
    },
  });
}
