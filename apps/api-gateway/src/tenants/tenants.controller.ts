import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import {
  createTenantViaGrpc,
  listTenantsViaGrpc,
  getTenantForUserViaGrpc,
  updateTenantViaGrpc,
  deleteTenantViaGrpc,
  listMembersViaGrpc,
  addMemberViaGrpc,
  updateMemberRoleViaGrpc,
  removeMemberViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantRolesGuard } from "../auth/tenant-roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// @Roles(...) below is a gateway-level fast-fail that exactly mirrors
// tenant-service's own MANAGE_TENANT_ROLES/requireRole checks
// (tenants.service.ts) -- that remains the authoritative enforcement,
// this just fails faster and documents the restriction at the routing
// layer too.
@Controller("tenants")
@UseGuards(GrpcAuthGuard, TenantRolesGuard)
export class TenantsController {
  @Post()
  create(@Req() req: Request, @Body() dto: CreateTenantDto) {
    return grpcCall(() => createTenantViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, dto));
  }

  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery) {
    return grpcCall(() => listTenantsViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, query));
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() =>
      getTenantForUserViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id),
    );
  }

  @Roles("owner", "admin")
  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return grpcCall(() =>
      updateTenantViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, dto),
    );
  }

  @Roles("owner")
  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string) {
    await grpcCall(() => deleteTenantViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id));
    return { success: true };
  }

  @Get(":id/members")
  listMembers(@Req() req: Request, @Param("id") id: string, @Query() query: RawListQuery) {
    return grpcCall(() =>
      listMembersViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, query),
    );
  }

  @Roles("owner", "admin")
  @Post(":id/members")
  addMember(@Req() req: Request, @Param("id") id: string, @Body() dto: AddMemberDto) {
    return grpcCall(() => addMemberViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, dto));
  }

  @Roles("owner")
  @Patch(":id/members/:userId")
  updateMemberRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return grpcCall(() =>
      updateMemberRoleViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, userId, dto.role),
    );
  }

  @Roles("owner", "admin")
  @Delete(":id/members/:userId")
  async removeMember(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    await grpcCall(() =>
      removeMemberViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id, userId),
    );
    return { success: true };
  }
}
