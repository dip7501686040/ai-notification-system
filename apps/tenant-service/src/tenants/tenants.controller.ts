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
import type { TenantMember } from "../../generated/prisma-client";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Mirrors BaseCrudController's route surface (list/get/create/update/delete)
// but doesn't extend it: every route here needs the caller's identity to
// enforce tenant-membership/role checks, which is incompatible with the
// base class's unscoped (id-only) method signatures. BaseCrudController
// stays available in @ai-notification/common for services with plain,
// ownerless CRUD.
@Controller("tenants")
@UseGuards(GrpcAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(currentUser(req).id, dto);
  }

  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery) {
    return this.tenantsService.findAllForUser(currentUser(req).id, query);
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return this.tenantsService.findOne(id, currentUser(req).id);
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateTenant(id, currentUser(req).id, dto);
  }

  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string) {
    await this.tenantsService.remove(id, currentUser(req).id);
    return { success: true };
  }

  @Get(":id/members")
  listMembers(@Req() req: Request, @Param("id") id: string, @Query() query: RawListQuery) {
    return this.tenantsService.listMembers(id, currentUser(req).id, query);
  }

  @Post(":id/members")
  addMember(@Req() req: Request, @Param("id") id: string, @Body() dto: AddMemberDto) {
    return this.tenantsService.addMember(id, currentUser(req).id, dto);
  }

  @Patch(":id/members/:userId")
  updateMemberRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<TenantMember> {
    return this.tenantsService.updateMemberRole(id, currentUser(req).id, userId, dto.role);
  }

  @Delete(":id/members/:userId")
  async removeMember(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    await this.tenantsService.removeMember(id, currentUser(req).id, userId);
    return { success: true };
  }
}
