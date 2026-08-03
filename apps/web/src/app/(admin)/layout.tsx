"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Activity, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
          <div className="brand-admin-icon flex size-7 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Platform Admin</p>
            <p className="text-xs text-muted-foreground">AI Notifications</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {[
            { href: "/admin/tenants", label: "Tenants", icon: ShieldCheck },
            { href: "/admin/platform-health", label: "Platform Health", icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-admin/10 text-admin"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
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
