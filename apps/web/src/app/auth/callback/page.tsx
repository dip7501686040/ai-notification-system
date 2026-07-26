"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackHandler />
    </Suspense>
  );
}

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/login?error=oauth_failed");
      return;
    }
    void login(token).then(() => router.replace("/"));
  }, [searchParams, login, router]);

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Signing you in...
    </div>
  );
}
