import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import Stripe from "stripe";
import type { Tenant } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env, isStripeConfigured } from "../env";
import type { TenantRole } from "./dto/add-member.dto";

const MANAGE_ROLES: TenantRole[] = ["owner", "admin"];
const PLAN_PRICES: Record<string, string | undefined> = {
  pro: env.STRIPE_PRICE_PRO,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
};

// Real Stripe integration (test mode in this deployment): tenant-service
// owns every actual Stripe API call (customer/checkout/portal/cancel);
// api-gateway only verifies the webhook signature (the one thing that
// must live at the public HTTP edge) and forwards the already-verified
// event here. Checkout Sessions carry {tenantId, plan} in metadata (on
// both the session and its subscription) so the webhook can attribute an
// event back to a tenant without a second lookup.
@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = isStripeConfigured ? new Stripe(env.STRIPE_SECRET_KEY!) : null;
  }

  async createCheckoutSession(
    tenantId: string,
    requesterId: string,
    plan: string,
  ): Promise<{ url: string }> {
    await this.requireRole(tenantId, requesterId, MANAGE_ROLES);
    const stripe = this.requireStripe();

    const priceId = PLAN_PRICES[plan];
    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for plan "${plan}"`);
    }

    const tenant = await this.getTenantOrThrow(tenantId);
    const customerId = await this.ensureStripeCustomer(stripe, tenant);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.FRONTEND_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.FRONTEND_URL}/dashboard/billing?checkout=canceled`,
      metadata: { tenantId, plan },
      subscription_data: { metadata: { tenantId, plan } },
    });

    if (!session.url) {
      throw new BadRequestException("Stripe did not return a checkout URL");
    }
    return { url: session.url };
  }

  async createPortalSession(tenantId: string, requesterId: string): Promise<{ url: string }> {
    await this.requireRole(tenantId, requesterId, MANAGE_ROLES);
    const stripe = this.requireStripe();

    const tenant = await this.getTenantOrThrow(tenantId);
    if (!tenant.stripeCustomerId) {
      throw new BadRequestException("This tenant has no billing history yet");
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${env.FRONTEND_URL}/dashboard/billing`,
    });
    return { url: portal.url };
  }

  // Cancels immediately (not at period end) -- simplest, honest behavior
  // for a demo. tenant.plan reverts to "free" once the resulting
  // customer.subscription.deleted webhook is applied, not optimistically
  // here, since Stripe is the source of truth for subscription state.
  async cancelSubscription(tenantId: string, requesterId: string): Promise<void> {
    await this.requireRole(tenantId, requesterId, MANAGE_ROLES);
    const stripe = this.requireStripe();

    const tenant = await this.getTenantOrThrow(tenantId);
    if (!tenant.stripeSubscriptionId) {
      throw new BadRequestException("This tenant has no active subscription");
    }

    await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);
  }

  // Internal, no requester -- api-gateway has already verified the
  // Stripe webhook signature before calling this; these are normalized
  // event kinds, not raw Stripe event.type strings, keeping the gRPC
  // contract stable regardless of Stripe's own naming.
  async applyWebhookEvent(
    kind: "checkout.completed" | "subscription.canceled",
    tenantId: string,
    plan: string,
    subscriptionId: string,
  ): Promise<void> {
    if (kind === "checkout.completed") {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan, stripeSubscriptionId: subscriptionId },
      });
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: "free", stripeSubscriptionId: null },
    });
  }

  private async ensureStripeCustomer(stripe: Stripe, tenant: Tenant): Promise<string> {
    if (tenant.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    });
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException("Billing is not configured on this deployment");
    }
    return this.stripe;
  }

  private async getTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  private async requireRole(
    tenantId: string,
    userId: string,
    allowedRoles: TenantRole[],
  ): Promise<void> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership) {
      throw new NotFoundException("Tenant not found");
    }
    if (!allowedRoles.includes(membership.role as TenantRole)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
  }
}
