import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import {
  listNotificationsViaGrpc,
  getNotificationViaGrpc,
  markNotificationReadViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Read-only for delivery lifecycle (managed entirely by notification-service's
// own consumer/retry-scheduler); mark-as-read is the one write route, since
// read/unread is a viewer-side concern rather than a delivery one.
@Controller("notifications")
@UseGuards(GrpcAuthGuard)
export class NotificationsController {
  @Get()
  list(
    @Req() req: Request,
    @Query() query: RawListQuery & { tenantId?: string; status?: string; readStatus?: string },
  ) {
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
        query.readStatus,
      ),
    );
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() =>
      getNotificationViaGrpc(env.NOTIFICATION_GRPC_ADDRESS, currentUser(req).id, id),
    );
  }

  @Patch(":id/read")
  markRead(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() =>
      markNotificationReadViaGrpc(env.NOTIFICATION_GRPC_ADDRESS, currentUser(req).id, id),
    );
  }
}
