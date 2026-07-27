"use client";

import { Card, CardContent } from "@/components/ui/card";

// Super Admin is already fully trusted, so this embeds the full,
// unfiltered Grafana dashboard directly -- no tenant-locking needed,
// unlike the per-tenant embeds in dashboard/observability/page.tsx.
const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL ?? "http://localhost:3011";

export default function PlatformHealthPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Health</h1>
        <p className="text-sm text-muted-foreground">
          CPU/memory per service and request/error rates across all tenants.
        </p>
      </div>

      <Card>
        <CardContent className="p-2">
          <iframe
            src={`${GRAFANA_URL}/d/platform-health/platform-health?kiosk`}
            title="Platform health"
            className="h-[85vh] w-full rounded-md border-0"
            referrerPolicy="no-referrer"
          />
        </CardContent>
      </Card>
    </div>
  );
}
