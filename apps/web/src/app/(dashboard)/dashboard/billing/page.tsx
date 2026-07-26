"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant-context";
import {
  useCancelSubscription,
  useCreateCheckoutSession,
  useCreatePortalSession,
} from "@/lib/hooks/use-billing";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Plan {
  id: "free" | "pro" | "enterprise";
  name: string;
  price: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0/mo",
    features: ["1,000 events/mo", "Email + webhook channels", "7-day audit log retention"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49/mo",
    features: ["50,000 events/mo", "All channels + AI analysis", "90-day audit log retention"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$249/mo",
    features: ["Unlimited events", "Priority support", "Unlimited audit log retention"],
  },
];

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTenant, activeRole } = useTenant();
  const tenantId = activeTenant!.id;
  const currentPlan = activeTenant!.plan;
  const canManage = activeRole === "owner" || activeRole === "admin";

  const createCheckout = useCreateCheckoutSession(tenantId);
  const createPortal = useCreatePortalSession(tenantId);
  const cancelSubscription = useCancelSubscription(tenantId);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Subscription updated");
      router.replace("/dashboard/billing");
    } else if (checkout === "canceled") {
      toast.info("Checkout canceled");
      router.replace("/dashboard/billing");
    }
  }, [searchParams, router]);

  async function handleUpgrade(plan: "pro" | "enterprise") {
    try {
      const { url } = await createCheckout.mutateAsync(plan);
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start checkout");
    }
  }

  async function handlePortal() {
    try {
      const { url } = await createPortal.mutateAsync();
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not open billing portal");
    }
  }

  async function handleCancel() {
    try {
      await cancelSubscription.mutateAsync();
      toast.success("Subscription canceled -- you're back on the Free plan");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not cancel subscription");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-muted-foreground">Manage your organization&apos;s plan.</p>
        </div>
        {canManage && currentPlan !== "free" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePortal} disabled={createPortal.isPending}>
              Manage billing
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelSubscription.isPending}
            >
              Downgrade to Free
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card key={plan.id} className={cn(isCurrent && "border-primary")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current plan</Badge>}
                </div>
                <p className="text-2xl font-semibold">{plan.price}</p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              {canManage && plan.id !== "free" && !isCurrent && (
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id as "pro" | "enterprise")}
                    disabled={createCheckout.isPending}
                  >
                    Upgrade to {plan.name}
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
