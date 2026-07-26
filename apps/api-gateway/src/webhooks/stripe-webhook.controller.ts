import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import Stripe from "stripe";
import { applyStripeWebhookEventViaGrpc } from "@ai-notification/grpc";
import { env } from "../env";

// Public -- Stripe calls this directly, so it can't go through
// GrpcAuthGuard. Authenticity comes entirely from verifying the
// Stripe-Signature header against the raw request body (main.ts's
// rawBody: true), not from any bearer token. This Stripe instance never
// makes an API call (constructEvent is pure local signature
// verification), so it doesn't need a real secret key.
const stripe = new Stripe("webhook-verification-only");

@Controller("webhooks/stripe")
export class StripeWebhookController {
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new BadRequestException("Stripe webhooks are not configured on this deployment");
    }
    if (!req.rawBody) {
      throw new BadRequestException("Missing raw request body");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid signature";
      throw new BadRequestException(`Webhook signature verification failed: ${message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (tenantId && plan && subscriptionId) {
        await applyStripeWebhookEventViaGrpc(
          env.TENANT_GRPC_ADDRESS,
          "checkout.completed",
          tenantId,
          plan,
          subscriptionId,
        );
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenantId;
      if (tenantId) {
        await applyStripeWebhookEventViaGrpc(
          env.TENANT_GRPC_ADDRESS,
          "subscription.canceled",
          tenantId,
          "",
          subscription.id,
        );
      }
    }

    return { received: true };
  }
}
