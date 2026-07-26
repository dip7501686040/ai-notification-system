import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated, Tenant } from "@/lib/types";

export function useAllTenants(search: string) {
  return useQuery({
    queryKey: ["admin-tenants", search],
    queryFn: () =>
      apiFetch<Paginated<Tenant>>("/admin/tenants", { query: { search, limit: "100" } }),
  });
}

export function useSetTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      apiFetch<Tenant>(`/admin/tenants/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });
}
