import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface BillingUrlResult {
  url: string;
}

export function useCreateCheckoutSession(tenantId: string) {
  return useMutation({
    mutationFn: (plan: "pro" | "enterprise") =>
      apiFetch<BillingUrlResult>(`/tenants/${tenantId}/billing/checkout`, {
        method: "POST",
        body: { plan },
      }),
  });
}

export function useCreatePortalSession(tenantId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<BillingUrlResult>(`/tenants/${tenantId}/billing/portal`, { method: "POST" }),
  });
}

export function useCancelSubscription(tenantId: string) {
  return useMutation({
    mutationFn: () => apiFetch(`/tenants/${tenantId}/billing/cancel`, { method: "POST" }),
  });
}
