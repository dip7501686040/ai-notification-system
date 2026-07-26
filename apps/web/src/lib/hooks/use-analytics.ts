import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { DailyEventCount, NotificationStats, SourceCount } from "@/lib/types";

export function useDailyEvents(tenantId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["analytics", "daily-events", tenantId, days],
    queryFn: () =>
      apiFetch<DailyEventCount[]>("/analytics/daily-events", { query: { tenantId, days } }),
    enabled: Boolean(tenantId),
  });
}

export function useTopSources(tenantId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["analytics", "top-sources", tenantId, days],
    queryFn: () => apiFetch<SourceCount[]>("/analytics/top-sources", { query: { tenantId, days } }),
    enabled: Boolean(tenantId),
  });
}

export function useNotificationStats(tenantId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["analytics", "notifications", tenantId, days],
    queryFn: () =>
      apiFetch<NotificationStats>("/analytics/notifications", { query: { tenantId, days } }),
    enabled: Boolean(tenantId),
  });
}
