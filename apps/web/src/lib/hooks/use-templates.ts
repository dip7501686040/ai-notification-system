import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Paginated, Template } from "@/lib/types";

export interface TemplateInput {
  tenantId: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
}

export function useTemplates(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["templates", tenantId],
    queryFn: () =>
      apiFetch<Paginated<Template>>("/templates", { query: { tenantId, limit: "100" } }),
    enabled: Boolean(tenantId),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateInput) =>
      apiFetch<Template>("/templates", { method: "POST", body: data }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["templates", variables.tenantId] });
    },
  });
}

export function useUpdateTemplate(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<TemplateInput> & { id: string }) =>
      apiFetch<Template>(`/templates/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates", tenantId] });
    },
  });
}

export function useDeleteTemplate(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates", tenantId] });
    },
  });
}
