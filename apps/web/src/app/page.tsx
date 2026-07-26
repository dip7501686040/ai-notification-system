"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { activeTenant, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (tenantLoading) return;
    if (!activeTenant) {
      router.replace("/tenants");
      return;
    }
    router.replace("/dashboard");
  }, [authLoading, tenantLoading, user, activeTenant, router]);

  return null;
}
