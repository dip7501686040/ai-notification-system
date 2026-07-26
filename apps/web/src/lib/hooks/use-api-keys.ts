import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ApiKey, CreatedApiKey, Paginated } from "@/lib/types";

export function useApiKeys(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", tenantId],
    queryFn: () => apiFetch<Paginated<ApiKey>>("/apikeys", { query: { tenantId, limit: "100" } }),
    enabled: Boolean(tenantId),
  });
}

export function useCreateApiKey(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; rateLimit?: number }) =>
      apiFetch<CreatedApiKey>("/apikeys", { method: "POST", body: { tenantId, ...data } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys", tenantId] });
    },
  });
}

export function useRotateApiKey(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreatedApiKey>(`/apikeys/${id}/rotate`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys", tenantId] });
    },
  });
}

export function useRevokeApiKey(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/apikeys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys", tenantId] });
    },
  });
}
