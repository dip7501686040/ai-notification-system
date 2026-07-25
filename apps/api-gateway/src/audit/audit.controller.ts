import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import { listAuditLogsViaGrpc, listMyAuditLogsViaGrpc } from "@ai-notification/grpc";
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

// Read-only: every row is system-computed by audit-service's own
// RabbitMQ consumer, same "no create/update/delete surface" shape as
// ai.controller.ts/analytics.controller.ts.
@Controller("audit-logs")
@UseGuards(GrpcAuthGuard)
export class AuditController {
  @Get()
  list(
    @Req() req: Request,
    @Query() query: RawListQuery & { tenantId?: string; days?: string; action?: string },
  ) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listAuditLogsViaGrpc(
        env.AUDIT_GRPC_ADDRESS,
        currentUser(req).id,
        query.tenantId!,
        query,
        parseIntOrUndefined(query.days),
        query.action,
      ),
    );
  }

  // Self-scoped -- no tenantId needed, actorId = the requester already
  // authorizes it (their own logins, their own rule changes across any
  // tenant they belong to).
  @Get("me")
  mine(@Req() req: Request, @Query() query: RawListQuery & { days?: string }) {
    return grpcCall(() =>
      listMyAuditLogsViaGrpc(
        env.AUDIT_GRPC_ADDRESS,
        currentUser(req).id,
        query,
        parseIntOrUndefined(query.days),
      ),
    );
  }
}
