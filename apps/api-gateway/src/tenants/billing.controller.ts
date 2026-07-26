import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  createCheckoutSessionViaGrpc,
  createPortalSessionViaGrpc,
  cancelSubscriptionViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantRolesGuard } from "../auth/tenant-roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Real Stripe integration (test mode) -- tenant-service owns every actual
// Stripe API call, this just proxies with the same owner/admin gating as
// every other tenant-management route (tenantId is the route param,
// same fast-fail shape as PATCH /tenants/:id).
@Controller("tenants/:id/billing")
@UseGuards(GrpcAuthGuard, TenantRolesGuard)
export class BillingController {
  @Roles("owner", "admin")
  @Post("checkout")
  createCheckout(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return grpcCall(() =>
      createCheckoutSessionViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, dto.plan),
    );
  }

  @Roles("owner", "admin")
  @Post("portal")
  createPortal(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() =>
      createPortalSessionViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id),
    );
  }

  @Roles("owner", "admin")
  @Post("cancel")
  async cancel(@Req() req: Request, @Param("id") id: string) {
    await grpcCall(() =>
      cancelSubscriptionViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id),
    );
    return { success: true };
  }
}
