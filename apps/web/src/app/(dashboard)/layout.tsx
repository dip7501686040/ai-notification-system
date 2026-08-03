"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { DashboardNav } from "@/components/dashboard-nav";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { UserMenu } from "@/components/user-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    }
  }, [authLoading, tenantLoading, user, activeTenant, router]);

  if (authLoading || tenantLoading || !user || !activeTenant) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="brand-icon flex size-7 items-center justify-center rounded-lg">
            <Bell className="size-4" />
          </div>
          <Link href="/dashboard" className="text-sm font-semibold">
            AI Notifications
          </Link>
        </div>
        <div className="p-2">
          <TenantSwitcher />
        </div>
        <DashboardNav />
        <div className="border-t border-border p-2">
          <UserMenu />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
