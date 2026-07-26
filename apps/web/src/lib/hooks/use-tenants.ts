import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated, Tenant, TenantMember, TenantRole } from "@/lib/types";

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      apiFetch<Tenant>("/tenants", { method: "POST", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; plan?: string; status?: string }) =>
      apiFetch<Tenant>(`/tenants/${tenantId}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => apiFetch(`/tenants/${tenantId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useTenantMembers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-members", tenantId],
    queryFn: () =>
      apiFetch<Paginated<TenantMember>>(`/tenants/${tenantId}/members`, {
        query: { limit: "100" },
      }),
    enabled: Boolean(tenantId),
  });
}

export function useAddMember(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; role?: TenantRole }) =>
      apiFetch<TenantMember>(`/tenants/${tenantId}/members`, { method: "POST", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    },
  });
}

export function useUpdateMemberRole(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TenantRole }) =>
      apiFetch<TenantMember>(`/tenants/${tenantId}/members/${userId}`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    },
  });
}

export function useRemoveMember(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/tenants/${tenantId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    },
  });
}
