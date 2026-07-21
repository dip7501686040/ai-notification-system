import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import { listNotificationsViaGrpc, getNotificationViaGrpc } from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Read-only: lifecycle is managed entirely by notification-service's own
// consumer/retry-scheduler (see NOTIFICATION_GRPC_ADDRESS's proto), not by
// external callers.
@Controller("notifications")
@UseGuards(GrpcAuthGuard)
export class NotificationsController {
  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string; status?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listNotificationsViaGrpc(
        env.NOTIFICATION_GRPC_ADDRESS,
        currentUser(req).id,
        query.tenantId!,
        query,
        query.status,
      ),
    );
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() =>
      getNotificationViaGrpc(env.NOTIFICATION_GRPC_ADDRESS, currentUser(req).id, id),
    );
  }
}
