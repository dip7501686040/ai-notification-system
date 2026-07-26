"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !user.isSuperAdmin) {
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
          <div className="flex size-7 items-center justify-center rounded-lg bg-admin text-admin-foreground">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Platform Admin</p>
            <p className="text-xs text-muted-foreground">AI Notifications</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          <Link
            href="/admin/tenants"
            className="flex items-center gap-2 rounded-md bg-admin/10 px-3 py-2 text-sm font-medium text-admin"
          >
            <ShieldCheck className="size-4" />
            Tenants
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border p-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <UserMenu />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
