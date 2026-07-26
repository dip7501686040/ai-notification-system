"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api-client";
import { useAuth } from "./auth-context";
import type { Paginated, TenantWithRole } from "./types";

interface TenantContextValue {
  tenants: TenantWithRole[];
  activeTenant: TenantWithRole | null;
  activeRole: TenantWithRole["role"] | null;
  isLoading: boolean;
  setActiveTenantId: (id: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);

  useEffect(() => {
    setActiveTenantIdState(localStorage.getItem("active_tenant_id"));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiFetch<Paginated<TenantWithRole>>("/tenants", { query: { limit: "100" } }),
    enabled: Boolean(user),
  });

  const tenants = useMemo(() => data?.list ?? [], [data]);

  useEffect(() => {
    if (!activeTenantId && tenants.length > 0) {
      setActiveTenantIdState(tenants[0]!.id);
      localStorage.setItem("active_tenant_id", tenants[0]!.id);
    }
  }, [activeTenantId, tenants]);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  function setActiveTenantId(id: string) {
    localStorage.setItem("active_tenant_id", id);
    setActiveTenantIdState(id);
    void queryClient.invalidateQueries();
  }

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenant,
        activeRole: activeTenant?.role ?? null,
        isLoading,
        setActiveTenantId,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
