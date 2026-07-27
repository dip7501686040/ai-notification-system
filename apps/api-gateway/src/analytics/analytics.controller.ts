import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  getDailyEventsViaGrpc,
  getTopSourcesViaGrpc,
  getNotificationStatsViaGrpc,
  getObservabilityLinksViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new BadRequestException("tenantId query param is required");
  }
  return tenantId;
}

// Read-only: every row here is system-computed by analytics-service's
// own RabbitMQ consumers, same "no create/update/delete surface" shape
// as ai.controller.ts's analyses endpoints.
@Controller("analytics")
@UseGuards(GrpcAuthGuard)
export class AnalyticsController {
  @Get("daily-events")
  dailyEvents(@Req() req: Request, @Query() query: { tenantId?: string; days?: string }) {
    const tenantId = requireTenantId(query.tenantId);
    return grpcCall(() =>
      getDailyEventsViaGrpc(
        env.ANALYTICS_GRPC_ADDRESS,
        currentUser(req).id,
        tenantId,
        parseIntOrUndefined(query.days),
      ),
    );
  }

  @Get("top-sources")
  topSources(
    @Req() req: Request,
    @Query() query: { tenantId?: string; days?: string; limit?: string },
  ) {
    const tenantId = requireTenantId(query.tenantId);
    return grpcCall(() =>
      getTopSourcesViaGrpc(
        env.ANALYTICS_GRPC_ADDRESS,
        currentUser(req).id,
        tenantId,
        parseIntOrUndefined(query.days),
        parseIntOrUndefined(query.limit),
      ),
    );
  }

  @Get("notifications")
  notificationStats(@Req() req: Request, @Query() query: { tenantId?: string; days?: string }) {
    const tenantId = requireTenantId(query.tenantId);
    return grpcCall(() =>
      getNotificationStatsViaGrpc(
        env.ANALYTICS_GRPC_ADDRESS,
        currentUser(req).id,
        tenantId,
        parseIntOrUndefined(query.days),
      ),
    );
  }

  // tenantId here is only ever the caller's own -- analytics-service
  // re-derives it server-side after its own membership check and bakes it
  // into the returned Grafana/Jaeger URLs, so this endpoint can't be used
  // to mint a link for a tenant the caller doesn't belong to.
  @Get("observability-links")
  observabilityLinks(@Req() req: Request, @Query() query: { tenantId?: string }) {
    const tenantId = requireTenantId(query.tenantId);
    return grpcCall(() =>
      getObservabilityLinksViaGrpc(env.ANALYTICS_GRPC_ADDRESS, currentUser(req).id, tenantId),
    );
  }
}
