import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { EventItem, Paginated } from "@/lib/types";

export function useEvents(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["events", tenantId],
    queryFn: () =>
      apiFetch<Paginated<EventItem>>("/events", {
        query: { tenantId, limit: "50", sort_fields: "createdAt", sort_type: "desc" },
      }),
    enabled: Boolean(tenantId),
    refetchInterval: 10_000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { tenantId: string; type: string; source?: string; payload: unknown }) =>
      apiFetch<EventItem>("/events", { method: "POST", body: data }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["events", variables.tenantId] });
    },
  });
}
