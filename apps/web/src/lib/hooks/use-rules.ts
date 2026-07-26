import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated, Rule, RuleAction } from "@/lib/types";

export interface RuleInput {
  tenantId: string;
  name: string;
  eventType: string;
  conditions?: unknown;
  actions: RuleAction[];
  enabled?: boolean;
}

export function useRules(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["rules", tenantId],
    queryFn: () => apiFetch<Paginated<Rule>>("/rules", { query: { tenantId, limit: "100" } }),
    enabled: Boolean(tenantId),
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RuleInput) => apiFetch<Rule>("/rules", { method: "POST", body: data }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["rules", variables.tenantId] });
    },
  });
}

export function useUpdateRule(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<RuleInput> & { id: string }) =>
      apiFetch<Rule>(`/rules/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rules", tenantId] });
    },
  });
}

export function useDeleteRule(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rules", tenantId] });
    },
  });
}
