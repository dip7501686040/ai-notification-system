import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Notification, Paginated } from "@/lib/types";

export function useNotifications(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", tenantId],
    queryFn: () =>
      apiFetch<Paginated<Notification>>("/notifications", {
        query: { tenantId, limit: "50", sort_fields: "createdAt", sort_type: "desc" },
      }),
    enabled: Boolean(tenantId),
  });
}

export function useMarkNotificationRead(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] });
    },
  });
}
