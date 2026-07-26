import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import { listAllTenantsViaGrpc, setTenantStatusViaGrpc } from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { SuperAdminGuard } from "../auth/super-admin.guard";
import { SetTenantStatusDto } from "./dto/set-tenant-status.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Platform-wide (Super Admin only) -- not scoped to the caller's own
// tenant memberships at all, unlike every other tenant-facing route in
// this codebase.
@Controller("admin/tenants")
@UseGuards(GrpcAuthGuard, SuperAdminGuard)
export class AdminTenantsController {
  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery) {
    return grpcCall(() =>
      listAllTenantsViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, query),
    );
  }

  @Patch(":id/status")
  setStatus(@Req() req: Request, @Param("id") id: string, @Body() dto: SetTenantStatusDto) {
    return grpcCall(() =>
      setTenantStatusViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, dto.status),
    );
  }
}
