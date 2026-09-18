"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { isDemoUser, resetDemoData } from "@/lib/demo";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { activeTenant } = useTenant();
  const [resetting, setResetting] = useState(false);
  if (!user) return null;

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  async function handleReset() {
    if (!activeTenant) return;
    setResetting(true);
    try {
      await resetDemoData(activeTenant.id);
      toast.success("Demo data reset — rules, templates, and events are fresh again.");
    } catch {
      toast.error("Reset failed — try again shortly.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-secondary/60">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.isSuperAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin/tenants">
              <ShieldCheck />
              Platform Admin
            </Link>
          </DropdownMenuItem>
        )}
        {isDemoUser(user.email) && (
          <DropdownMenuItem onClick={handleReset} disabled={resetting}>
            <RotateCcw />
            {resetting ? "Resetting…" : "Reset demo data"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={logout} variant="destructive">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
